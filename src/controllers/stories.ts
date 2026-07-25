import { Request, Response, NextFunction } from 'express';
import Story from '../models/story';
import User from '../models/user';
import { cloudinary } from '../config/cloudinary';
import PDFDocument from 'pdfkit';

export const getStories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const searchQuery = req.query.search as string || '';
    const categoryQuery = req.query.category as string || '';
    const sortQuery = req.query.sort as string || '';

    // Aggregation for top 5 writers based on stories array count
    const topFiveWriters = await User.aggregate([
      {
        $lookup: {
          from: 'stories',
          localField: 'stories',
          foreignField: '_id',
          as: 'storyDetails'
        }
      },
      {
        $addFields: {
          storiesCount: { $size: '$storyDetails' }
        }
      },
      {
        $sort: { storiesCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          _id: 1,
          username: 1,
          name: 1,
          followers: 1,
          'image.url': 1,
          storiesCount: 1
        }
      }
    ]);

    const filter: any = {};
    if (searchQuery) {
      filter.title = { $regex: searchQuery, $options: 'i' };
    }
    if (categoryQuery && categoryQuery !== 'all') {
      filter.category = categoryQuery;
    }

    const sort: any = { timeStamp: -1 };
    if (sortQuery === 'oldest') {
      sort.timeStamp = 1;
    }

    const stories = await Story.find(filter)
      .sort(sort)
      .populate('owner', 'username name image')
      .exec();

    res.status(200).json({
      success: true,
      stories,
      topFiveWriters
    });
  } catch (error) {
    next(error);
  }
};

export const getStoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user as any)._id : null;

    const story = await Story.findById(id)
      .populate('owner', 'username name image bio')
      .populate({
        path: 'comments',
        populate: { path: 'author', select: 'username name image' },
        options: { sort: { timeStamp: -1 } }
      });

    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    // Increment views if logged in user has not viewed this story yet
    if (userId && !story.views.some(vid => vid.toString() === userId.toString())) {
      story.views.push(userId);
      await story.save();
    }

    const isLiked = userId ? story.likedBy.some(lid => lid.toString() === userId.toString()) : false;

    res.status(200).json({
      success: true,
      story,
      isLiked
    });
  } catch (error) {
    next(error);
  }
};

export const createStory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)._id;
    const { title, story, category } = req.body;

    if (!req.file) {
       res.status(400).json({ error: 'Story cover image is required.' });
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
        publicId: req.file.filename
      }
    });

    const user = await User.findById(userId);
    if (!user) {
       res.status(404).json({ error: 'Owner user not found.' });
       return;
    }

    user.stories.push(newStory._id as any);

    await newStory.save();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Story created successfully!',
      story: newStory
    });
  } catch (error) {
    next(error);
  }
};

export const updateStory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)._id;
    const { title, story, category } = req.body;

    const existingStory = await Story.findById(id);
    if (!existingStory) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    if (!existingStory.owner.equals(userId)) {
       res.status(403).json({ error: 'You are not authorized to edit this story.' });
       return;
    }

    existingStory.title = title || existingStory.title;
    existingStory.story = story || existingStory.story;
    existingStory.category = category || existingStory.category;
    existingStory.editedAt = new Date();

    if (req.file) {
      // Destroy old cover image in Cloudinary if it exists
      if (existingStory.image?.publicId) {
        try {
          await cloudinary.uploader.destroy(existingStory.image.publicId);
        } catch (destroyErr) {
          console.error('Failed to destroy old Cloudinary image:', destroyErr);
        }
      }

      existingStory.image = {
        url: req.file.path,
        filename: req.file.filename,
        publicId: req.file.filename
      };
    }

    await existingStory.save();

    res.status(200).json({
      success: true,
      message: 'Story updated successfully!',
      story: existingStory
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)._id;

    const story = await Story.findById(id);
    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    if (!story.owner.equals(userId)) {
       res.status(452).json({ error: 'You are not authorized to delete this story.' });
       return;
    }

    if (story.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(story.image.publicId);
      } catch (destroyErr) {
        console.error('Failed to destroy Cloudinary image:', destroyErr);
      }
    }

    await Story.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Story deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

export const likeStory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)._id;

    const story = await Story.findById(id).populate('owner');
    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    const alreadyLiked = story.likedBy.some(lid => lid.toString() === userId.toString());

    if (alreadyLiked) {
      story.likedBy = story.likedBy.filter(uid => !uid.equals(userId));
      story.likesCounts = Math.max(0, story.likesCounts - 1);
    } else {
      story.likedBy.push(userId);
      story.likesCounts += 1;

      // Notify story owner (if not liking own story)
      const storyOwner = story.owner as any;
      if (storyOwner && !storyOwner._id.equals(userId)) {
        storyOwner.notifications.push({
          type: 'like',
          fromUser: userId,
          storyId: story._id as any,
          timeStamp: new Date(),
          read: false
        });
        await storyOwner.save();

        // Emit real-time update if socket io is bound
        const io = req.app.get('io');
        if (io) {
          io.to(storyOwner._id.toString()).emit('newNotification', {
            type: 'like',
            fromUser: {
              _id: userId,
              username: (req.user as any).username,
              image: (req.user as any).image
            },
            storyId: {
              _id: story._id,
              title: story.title
            }
          });
        }
      }
    }

    await story.save();

    res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likesCount: story.likesCounts,
      message: alreadyLiked ? 'Story unliked.' : 'Story liked!'
    });
  } catch (error) {
    next(error);
  }
};

export const getLikedBy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id).populate('likedBy', 'username name image');
    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    res.status(200).json({
      success: true,
      likedBy: story.likedBy
    });
  } catch (error) {
    next(error);
  }
};

export const downloadStoryPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id).populate('owner', 'username name');
    if (!story) {
       res.status(404).json({ error: 'Story not found.' });
       return;
    }

    const doc = new PDFDocument({
      size: 'A5',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      layout: 'portrait',
      info: {
        Title: story.title,
        Author: (story.owner as any).username || 'Unknown Author',
        Creator: 'Diary App'
      }
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    const applyStyles = (type: string) => {
      switch (type) {
        case 'title':
          return doc.font('Helvetica-Bold').fontSize(24).fillColor('#333');
        case 'subtitle':
          return doc.font('Helvetica-BoldOblique').fontSize(14).fillColor('#555');
        case 'body':
          return doc.font('Helvetica').fontSize(11).fillColor('#222');
        case 'caption':
          return doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666');
        default:
          return doc.font('Helvetica').fontSize(12).fillColor('#000');
      }
    };

    // Draw background cover page
    doc.fillColor('#ffffff').rect(0, 0, doc.page.width, doc.page.height).fill();

    applyStyles('title').text(story.title, 50, doc.y + 30, {
      width: doc.page.width - 100,
      align: 'center'
    });

    if (story.owner) {
      applyStyles('subtitle').text(`by ${(story.owner as any).username}`, 50, doc.y + 10, {
        width: doc.page.width - 100,
        align: 'center'
      });
    }

    // Add main content page
    doc.addPage();

    const headerHeight = 30;
    doc.fillColor('#f5f5f5').rect(0, 0, doc.page.width, headerHeight).fill();

    applyStyles('subtitle').text(story.title, 50, 10, {
      width: doc.page.width - 100,
      align: 'center'
    });

    // Strip HTML tags for clean PDF print
    const textContent = story.story.replace(/<[^>]*>/g, '');
    const normalizedText = textContent.replace(/\r?\n/g, '\n').trim();
    const paragraphs = normalizedText.split('\n\n');

    let currentY = headerHeight + 30;
    const lineGap = 4;
    const paragraphSpacing = 8;

    // Drop cap for the first paragraph
    if (paragraphs.length > 0) {
      const firstPara = paragraphs[0];
      const firstChar = firstPara.charAt(0);
      const remainingText = firstPara.substring(1);

      applyStyles('body');
      doc.fontSize(24).text(firstChar, 50, currentY, {
        continued: true,
        lineGap: lineGap
      });

      doc.fontSize(11).text(remainingText, {
        lineGap: lineGap,
        paragraphGap: paragraphSpacing
      });

      currentY = doc.y + paragraphSpacing;
    }

    // Output subsequent paragraphs
    for (let i = 1; i < paragraphs.length; i++) {
      if (paragraphs[i].trim() === '') continue;

      if (currentY > doc.page.height - 100) {
        doc.addPage();
        doc.fillColor('#f5f5f5').rect(0, 0, doc.page.width, headerHeight).fill();
        currentY = headerHeight + 30;
      }

      applyStyles('body');
      doc.text(paragraphs[i], 50, currentY, {
        width: doc.page.width - 100,
        indent: 20,
        lineGap: lineGap,
        paragraphGap: paragraphSpacing
      });

      currentY = doc.y + paragraphSpacing;
    }

    // Build page footer indices
    doc.flushPages();
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      if (i === 0) continue; // Cover page gets no footer label

      applyStyles('caption');
      doc.text(`Page ${i} of ${totalPages - 1}`, doc.page.width - 100, doc.page.height - 30, {
        align: 'right'
      });
    }

    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${story.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
      res.send(pdfData);
    });

    doc.end();
  } catch (error) {
    next(error);
  }
};

export const searchGifs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q) {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }
    const apiKey = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC'; // Fallback to Giphy public key if not configured
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q as string)}&limit=24`);
    const data = await response.json() as any;
    res.status(200).json(data.data || []);
  } catch (error) {
    next(error);
  }
};
