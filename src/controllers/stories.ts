import { Request, Response, NextFunction } from "express";
import Story from "../models/story";
import User from "../models/user";
import { cloudinary } from "../config/cloudinary";
import PDFDocument from "pdfkit";
import axios from "axios";

// ============================================
// GET ALL STORIES
// ============================================
export const getStories = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const searchQuery = (req.query.search as string) || "";
    const categoryQuery = (req.query.category as string) || "";
    const sortQuery = (req.query.sort as string) || "best";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, parseInt(req.query.limit as string) || 12);
    const skip = (page - 1) * limit;

    // ── FILTERS ──
    const filter: Record<string, any> = {};
    if (searchQuery) {
      filter.$or = [
        { title: { $regex: searchQuery, $options: "i" } },
        { category: { $regex: searchQuery, $options: "i" } },
      ];
    }
    if (categoryQuery && categoryQuery !== "all") {
      filter.category = categoryQuery;
    }

    // ── STORIES ──
    // best   → score-based (aggregate)
    // newest → timeStamp DESC (find)
    // oldest → timeStamp ASC (find)
    let stories: any[] = [];
    let totalStories = 0;

    if (sortQuery === "best") {
      // Score-based sort using aggregate
      const [result, countResult] = await Promise.all([
        Story.aggregate([
          { $match: filter },
          {
            $addFields: {
              viewsCount: { $size: { $ifNull: ["$views", []] } },
              likesCount: { $size: { $ifNull: ["$likedBy", []] } },
            },
          },
          {
            $addFields: {
              score: {
                $add: [{ $multiply: ["$likesCount", 5] }, "$viewsCount"],
              },
            },
          },
          { $sort: { score: -1, timeStamp: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerData",
              pipeline: [
                { $project: { username: 1, name: 1, "image.url": 1 } },
              ],
            },
          },
          {
            $unwind: {
              path: "$ownerData",
              preserveNullAndEmptyArrays: true,
            },
          },
          { $addFields: { owner: "$ownerData" } },
          { $project: { ownerData: 0 } },
        ]),
        Story.countDocuments(filter),
      ]);

      stories = result;
      totalStories = countResult;
    } else {
      // Time-based sort (newest / oldest)
      const sortOptions: Record<string, any> = {
        newest: { timeStamp: -1 },
        oldest: { timeStamp: 1 },
      };

      const sort = sortOptions[sortQuery] || sortOptions.newest;

      const [result, countResult] = await Promise.all([
        Story.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select(
            "title story category image timeStamp likesCounts likedBy views owner",
          )
          .populate("owner", "username name image")
          .lean()
          .exec(),
        Story.countDocuments(filter),
      ]);

      stories = result;
      totalStories = countResult;
    }

    // ── TOP 5 TRENDING STORIES ──
    const topFiveStories = await Story.aggregate([
      {
        $addFields: {
          viewsCount: { $size: { $ifNull: ["$views", []] } },
          likesCount: { $size: { $ifNull: ["$likedBy", []] } },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $add: [{ $multiply: ["$likesCount", 5] }, "$viewsCount"],
          },
        },
      },
      // Minimum engagement — hides brand-new empty stories
      {
        $match: {
          $or: [{ likesCount: { $gte: 1 } }, { viewsCount: { $gte: 5 } }],
        },
      },
      {
        $sort: {
          trendingScore: -1,
          likesCount: -1,
          timeStamp: -1,
        },
      },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerData",
          pipeline: [{ $project: { username: 1, name: 1, "image.url": 1 } }],
        },
      },
      {
        $unwind: {
          path: "$ownerData",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $addFields: { owner: "$ownerData" } },
      { $project: { ownerData: 0 } },
    ]);

    // ── TOP 5 WRITERS ──
    const topFiveWriters = await User.aggregate([
      {
        $lookup: {
          from: "stories",
          localField: "stories",
          foreignField: "_id",
          as: "storyDetails",
        },
      },
      {
        $addFields: {
          storiesCount: { $size: "$storyDetails" },
          followersCount: { $size: { $ifNull: ["$followers", []] } },
          totalLikes: {
            $sum: {
              $map: {
                input: "$storyDetails",
                as: "s",
                in: { $size: { $ifNull: ["$$s.likedBy", []] } },
              },
            },
          },
          totalViews: {
            $sum: {
              $map: {
                input: "$storyDetails",
                as: "s",
                in: { $size: { $ifNull: ["$$s.views", []] } },
              },
            },
          },
        },
      },
      {
        $addFields: {
          writerScore: {
            $add: [
              { $multiply: ["$followersCount", 10] },
              { $multiply: ["$totalLikes", 5] },
              "$totalViews",
              { $multiply: ["$storiesCount", 2] },
            ],
          },
        },
      },
      { $match: { storiesCount: { $gt: 0 } } },
      { $sort: { writerScore: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          username: 1,
          name: 1,
          followers: 1,
          "image.url": 1,
          storiesCount: 1,
          totalLikes: 1,
          totalViews: 1,
        },
      },
    ]);

    const totalPages = Math.ceil(totalStories / limit);

    res.status(200).json({
      success: true,
      stories,
      pagination: {
        currentPage: page,
        totalPages,
        totalStories,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      topFiveStories,
      trendingStories: topFiveStories,
      topFiveWriters,
    });
  } catch (error) {
    next(error);
  }
};
// ============================================
// GET STORY BY ID
// ============================================
export const getStoryById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user as any)._id : null;

    const story = await Story.findById(id)
      .populate("owner", "username name image bio")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username name image" },
        options: { sort: { timeStamp: -1 } },
      });

    if (!story) {
      res.status(404).json({ success: false, error: "Story not found." });
      return;
    }

    // Count unique views only
    if (
      userId &&
      !story.views.some((vid) => vid.toString() === userId.toString())
    ) {
      story.views.push(userId);
      await story.save();
    }

    const isLiked = userId
      ? story.likedBy.some((lid) => lid.toString() === userId.toString())
      : false;

    res.status(200).json({
      success: true,
      story,
      isLiked,
      meta: {
        likesCount: story.likedBy?.length || 0,
        viewsCount: story.views?.length || 0,
        commentsCount: story.comments?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// CREATE STORY
// ============================================
export const createStory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { title, story, category } = req.body;

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: "Story cover image is required.",
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    const newStory = new Story({
      title,
      story,
      category,
      owner: userId,
      image: {
        url: req.file.path,
        filename: req.file.filename,
        publicId: req.file.filename,
      },
    });

    user.stories.push(newStory._id as any);
    await Promise.all([newStory.save(), user.save()]);

    res.status(201).json({
      success: true,
      message: "Story created successfully!",
      story: newStory,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// UPDATE STORY
// ============================================
export const updateStory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)._id;
    const { title, story, category } = req.body;

    const existingStory = await Story.findById(id);
    if (!existingStory) {
      res.status(404).json({ success: false, error: "Story not found." });
      return;
    }

    if (!existingStory.owner.equals(userId)) {
      res.status(403).json({
        success: false,
        error: "You are not authorized to edit this story.",
      });
      return;
    }

    if (title) existingStory.title = title;
    if (story) existingStory.story = story;
    if (category) existingStory.category = category;
    existingStory.editedAt = new Date();

    if (req.file) {
      if (existingStory.image?.publicId) {
        try {
          await cloudinary.uploader.destroy(existingStory.image.publicId);
        } catch (err) {
          console.error("Cloudinary destroy failed:", err);
        }
      }
      existingStory.image = {
        url: req.file.path,
        filename: req.file.filename,
        publicId: req.file.filename,
      };
    }

    await existingStory.save();

    res.status(200).json({
      success: true,
      message: "Story updated successfully!",
      story: existingStory,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DELETE STORY
// ============================================
export const deleteStory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)._id;

    const story = await Story.findById(id);
    if (!story) {
      res.status(404).json({ success: false, error: "Story not found." });
      return;
    }

    if (!story.owner.equals(userId)) {
      res.status(403).json({
        success: false,
        error: "You are not authorized to delete this story.",
      });
      return;
    }

    await Promise.all([
      story.image?.publicId
        ? cloudinary.uploader.destroy(story.image.publicId).catch(console.error)
        : Promise.resolve(),
      Story.findByIdAndDelete(id),
      User.updateOne({ _id: userId }, { $pull: { stories: story._id } }),
    ]);

    res.status(200).json({
      success: true,
      message: "Story deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// LIKE / UNLIKE STORY
// ============================================
export const likeStory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)._id;

    const story = await Story.findById(id).populate(
      "owner",
      "_id username image",
    );
    if (!story) {
      res.status(404).json({ success: false, error: "Story not found." });
      return;
    }

    const alreadyLiked = story.likedBy.some(
      (lid) => lid.toString() === userId.toString(),
    );

    if (alreadyLiked) {
      await Story.updateOne(
        { _id: id },
        { $pull: { likedBy: userId }, $inc: { likesCounts: -1 } },
      );
    } else {
      await Story.updateOne(
        { _id: id },
        { $addToSet: { likedBy: userId }, $inc: { likesCounts: 1 } },
      );

      const storyOwner = story.owner as any;
      if (storyOwner && !storyOwner._id.equals(userId)) {
        await User.updateOne(
          { _id: storyOwner._id },
          {
            $push: {
              notifications: {
                type: "like",
                fromUser: userId,
                storyId: story._id,
                timeStamp: new Date(),
                read: false,
              },
            },
          },
        );

        const io = req.app.get("io");
        if (io) {
          io.to(storyOwner._id.toString()).emit("newNotification", {
            type: "like",
            fromUser: {
              _id: userId,
              username: (req.user as any).username,
              image: (req.user as any).image,
            },
            storyId: { _id: story._id, title: story.title },
          });
        }
      }
    }

    const newLikesCount = alreadyLiked
      ? Math.max(0, story.likesCounts - 1)
      : story.likesCounts + 1;

    res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likesCount: newLikesCount,
      message: alreadyLiked ? "Story unliked." : "Story liked!",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET LIKED BY
// ============================================
export const getLikedBy = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const story = await Story.findById(id)
      .select("likedBy")
      .populate("likedBy", "username name image")
      .lean();

    if (!story) {
      res.status(404).json({ success: false, error: "Story not found." });
      return;
    }

    res.status(200).json({
      success: true,
      likedBy: story.likedBy,
      count: story.likedBy?.length || 0,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DOWNLOAD STORY AS PDF
// ============================================
export const downloadStoryPDF = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const story = await Story.findById(id).populate("owner", "username name");

    if (!story) {
      res.status(404).json({ success: false, error: "Story not found." });
      return;
    }

    const doc = new PDFDocument({
      size: "A5",
      margins: { top: 50, bottom: 60, left: 45, right: 45 },
      layout: "portrait",
      bufferPages: true,
      info: {
        Title: story.title,
        Author: (story.owner as any)?.username || "Unknown",
        Creator: "DIARY App",
      },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    // Cover page
    doc.moveDown(4);
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#111111")
      .text(story.title, { align: "center" });

    if (story.owner) {
      doc.moveDown(1);
      doc
        .font("Helvetica-Oblique")
        .fontSize(14)
        .fillColor("#555555")
        .text(`by ${(story.owner as any).username}`, { align: "center" });
    }

    // Cover image
    if (story.image?.url) {
      try {
        const response = await axios.get(story.image.url, {
          responseType: "arraybuffer",
          timeout: 10000,
        });
        const imageBuffer = Buffer.from(response.data);
        doc.moveDown(3);
        doc.image(imageBuffer, {
          fit: [doc.page.width - 90, 300],
          align: "center",
          valign: "center",
        });
      } catch (err) {
        console.error("Cover image fetch failed:", err);
      }
    }

    // Content pages
    doc.addPage();

    const textContent = story.story
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');

    const paragraphs = textContent
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    doc.font("Helvetica").fontSize(11).fillColor("#222222");

    paragraphs.forEach((para, index) => {
      doc.text(para, {
        align: "justify",
        indent: index === 0 ? 0 : 20,
        lineGap: 5,
        paragraphGap: 10,
      });
    });

    // Page numbers
    doc.flushPages();
    const totalPages = doc.bufferedPageRange().count;

    for (let i = 1; i < totalPages; i++) {
      doc.switchToPage(i);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#888888")
        .text(`${i}`, 0, doc.page.height - 40, {
          align: "center",
          width: doc.page.width,
        });
    }

    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      const safeTitle = story.title
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()
        .slice(0, 50);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeTitle}.pdf"`,
      );
      res.setHeader("Content-Length", pdfData.length);
      res.send(pdfData);
    });

    doc.on("error", (err) => {
      console.error("PDF generation error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Failed to generate PDF.",
        });
      }
    });

    doc.end();
  } catch (error) {
    next(error);
  }
};

// ============================================
// SEARCH GIFS
// ============================================
export const searchGifs = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { q } = req.query;

    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: "Giphy API key not configured.",
      });
      return;
    }

    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
        q as string,
      )}&limit=24`,
    );

    const data = (await response.json()) as any;
        

    res.status(200).json({
      success: true,
      gifs: data.data || [],
    });
  } catch (error) {
    next(error);
  }
};
