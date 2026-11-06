import mongoose from "mongoose";
import Story from "../models/story";
import User from "../models/user";

/* ============================================================================
 * Interfaces
 * ========================================================================== */

export interface IStreakStats {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  isStreakActiveToday: boolean;
}

export interface IGoalStats {
  dailyTarget: number;
  dailyCompleted: number;
  dailyRemaining: number;
  dailyProgressPercent: number;
  isDailyGoalMet: boolean;
  weeklyTarget: number;
  weeklyCompleted: number;
  weeklyRemaining: number;
  weeklyProgressPercent: number;
  isWeeklyGoalMet: boolean;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
}

export interface IWritingStreakAndGoalsResult {
  streak: IStreakStats;
  goals: IGoalStats;
  summary: {
    totalPublishedStories: number;
    todayDate: string;
    timezone: string;
  };
}

/* ============================================================================
 * Timezone & Date Math Helpers (Pure UTC Calendar Math)
 * ========================================================================== */

/**
 * Format any Date into YYYY-MM-DD in the specified IANA timezone.
 * Falls back to UTC ISO date string if timezone is absent or invalid.
 */
export const formatDateInTimezone = (date: Date, tz?: string): string => {
  if (tz) {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(date);
    } catch {
      // Fallback if timezone string is invalid
    }
  }
  return date.toISOString().split("T")[0];
};

/**
 * Converts a YYYY-MM-DD string into an integer epoch day index.
 * Guaranteed immune to DST transitions because Date.UTC is uniform.
 */
export const getUtcDayNumber = (dateStr: string): number => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

/**
 * Returns the calendar day immediately preceding dateStr (YYYY-MM-DD).
 */
export const getPreviousDayString = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const prevDate = new Date(Date.UTC(year, month - 1, day - 1));
  return prevDate.toISOString().split("T")[0];
};

/**
 * Calculates the ISO 8601 week range (Monday through Sunday) for a given dateStr.
 */
export const getIsoWeekRange = (
  dateStr: string
): { mondayStr: string; sundayStr: string } => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utc.getUTCDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 (Mon) to 7 (Sun)

  const mondayUtc = new Date(utc.getTime() - (isoDay - 1) * 86400000);
  const sundayUtc = new Date(utc.getTime() + (7 - isoDay) * 86400000);

  return {
    mondayStr: mondayUtc.toISOString().split("T")[0],
    sundayStr: sundayUtc.toISOString().split("T")[0],
  };
};

/* ============================================================================
 * Core Streak & Goals Calculation
 * ========================================================================== */

/**
 * Calculates the complete writing streak and goal progress for an authenticated user.
 * Derived solely from published stories owned by this user.
 */
export const calculateUserStreakAndGoals = async (
  userId: string | mongoose.Types.ObjectId,
  timezone?: string
): Promise<IWritingStreakAndGoalsResult> => {
  const objectId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

  // 1. Fetch user's configured writing goals (with schema defaults fallback)
  const user = await User.findById(objectId).select("writingGoals").lean().exec();
  const dailyTarget = Math.max(1, user?.writingGoals?.dailyTarget ?? 1);
  const weeklyTarget = Math.max(1, user?.writingGoals?.weeklyTarget ?? 5);

  // 2. Fetch all published stories owned by this user, indexed by { owner: 1, timeStamp: -1 }
  const stories = await Story.find({ owner: objectId })
    .select("_id timeStamp")
    .sort({ timeStamp: 1 })
    .lean()
    .exec();

  const now = new Date();
  const todayStr = formatDateInTimezone(now, timezone);
  const yesterdayStr = getPreviousDayString(todayStr);
  const { mondayStr, sundayStr } = getIsoWeekRange(todayStr);

  // 3. Aggregate story counts per calendar date in user's timezone
  const dateStoryCountMap = new Map<string, number>();

  for (const story of stories) {
    if (!story.timeStamp) continue;
    const storyDate = new Date(story.timeStamp);
    const dateStr = formatDateInTimezone(storyDate, timezone);
    dateStoryCountMap.set(dateStr, (dateStoryCountMap.get(dateStr) || 0) + 1);
  }

  // Sorted list of unique active dates
  const uniqueDates = Array.from(dateStoryCountMap.keys()).sort();
  const totalActiveDays = uniqueDates.length;
  const activeDateSet = new Set(uniqueDates);

  // 4. Calculate Longest Streak (All-time consecutive active writing days)
  let longestStreak = 0;
  let currentRun = 0;
  let prevDayNum: number | null = null;

  for (const dateStr of uniqueDates) {
    const dayNum = getUtcDayNumber(dateStr);
    if (prevDayNum === null) {
      currentRun = 1;
    } else if (dayNum - prevDayNum === 1) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }

    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
    prevDayNum = dayNum;
  }

  // 5. Calculate Current Streak
  // If user published today: streak is alive including today.
  // If user has not published today yet, but published yesterday: streak is maintained awaiting today.
  // If user missed both yesterday and today: streak is 0.
  const hasToday = activeDateSet.has(todayStr);
  const hasYesterday = activeDateSet.has(yesterdayStr);

  let currentStreak = 0;
  const isStreakActiveToday = hasToday;

  if (hasToday) {
    currentStreak = 1;
    let checkDateStr = yesterdayStr;
    while (activeDateSet.has(checkDateStr)) {
      currentStreak += 1;
      checkDateStr = getPreviousDayString(checkDateStr);
    }
  } else if (hasYesterday) {
    currentStreak = 1;
    let checkDateStr = getPreviousDayString(yesterdayStr);
    while (activeDateSet.has(checkDateStr)) {
      currentStreak += 1;
      checkDateStr = getPreviousDayString(checkDateStr);
    }
  } else {
    currentStreak = 0;
  }

  // 6. Calculate Daily Goal Progress
  const dailyCompleted = dateStoryCountMap.get(todayStr) || 0;
  const dailyRemaining = Math.max(0, dailyTarget - dailyCompleted);
  const dailyProgressPercent = Math.min(
    100,
    Math.round((dailyCompleted / dailyTarget) * 100)
  );
  const isDailyGoalMet = dailyCompleted >= dailyTarget;

  // 7. Calculate Weekly Goal Progress (Monday to Sunday)
  let weeklyCompleted = 0;
  for (const [dateStr, count] of dateStoryCountMap.entries()) {
    if (dateStr >= mondayStr && dateStr <= sundayStr) {
      weeklyCompleted += count;
    }
  }
  const weeklyRemaining = Math.max(0, weeklyTarget - weeklyCompleted);
  const weeklyProgressPercent = Math.min(
    100,
    Math.round((weeklyCompleted / weeklyTarget) * 100)
  );
  const isWeeklyGoalMet = weeklyCompleted >= weeklyTarget;

  return {
    streak: {
      currentStreak,
      longestStreak,
      totalActiveDays,
      isStreakActiveToday,
    },
    goals: {
      dailyTarget,
      dailyCompleted,
      dailyRemaining,
      dailyProgressPercent,
      isDailyGoalMet,
      weeklyTarget,
      weeklyCompleted,
      weeklyRemaining,
      weeklyProgressPercent,
      isWeeklyGoalMet,
      weekStart: mondayStr,
      weekEnd: sundayStr,
    },
    summary: {
      totalPublishedStories: stories.length,
      todayDate: todayStr,
      timezone: timezone || "UTC",
    },
  };
};
