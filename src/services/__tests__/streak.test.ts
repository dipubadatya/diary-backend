import {
  formatDateInTimezone,
  getUtcDayNumber,
  getPreviousDayString,
  getIsoWeekRange,
} from "../streak.service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log("=== RUNNING STREAK & GOALS UNIT TESTS ===\n");

// Scenario 1: Date formatting across timezones
const testDate = new Date("2026-11-06T00:30:00Z");
// In UTC: 2026-11-06
assert(formatDateInTimezone(testDate, "UTC") === "2026-11-06", "UTC timezone format");
// In America/New_York (UTC-5 or -4 depending on DST): previous evening 2026-11-05
assert(formatDateInTimezone(testDate, "America/New_York") === "2026-11-05", "New York timezone format");
// In Asia/Kolkata (UTC+5:30): 2026-11-06
assert(formatDateInTimezone(testDate, "Asia/Kolkata") === "2026-11-06", "Kolkata timezone format");

// Scenario 2: Epoch day difference across month and year boundaries
const oct31 = getUtcDayNumber("2026-10-31");
const nov01 = getUtcDayNumber("2026-11-01");
assert(nov01 - oct31 === 1, "Month boundary consecutive days (Oct 31 -> Nov 01)");

const dec31 = getUtcDayNumber("2025-12-31");
const jan01 = getUtcDayNumber("2026-01-01");
assert(jan01 - dec31 === 1, "Year boundary consecutive days (Dec 31 -> Jan 01)");

const leapFeb28 = getUtcDayNumber("2024-02-28");
const leapFeb29 = getUtcDayNumber("2024-02-29");
const leapMar01 = getUtcDayNumber("2024-03-01");
assert(leapFeb29 - leapFeb28 === 1, "Leap year Feb 28 -> Feb 29");
assert(leapMar01 - leapFeb29 === 1, "Leap year Feb 29 -> Mar 01");

// Scenario 3: Previous day string calculation
assert(getPreviousDayString("2026-11-01") === "2026-10-31", "Previous day of Nov 01 is Oct 31");
assert(getPreviousDayString("2026-01-01") === "2025-12-31", "Previous day of Jan 01 is Dec 31");

// Scenario 4: ISO week range calculation (Monday to Sunday)
// 2026-11-06 is Friday. Monday was Nov 02, Sunday is Nov 08
const week1 = getIsoWeekRange("2026-11-06");
assert(week1.mondayStr === "2026-11-02", "Friday's week starts on Monday 2026-11-02");
assert(week1.sundayStr === "2026-11-08", "Friday's week ends on Sunday 2026-11-08");

// 2026-11-02 is Monday.
const week2 = getIsoWeekRange("2026-11-02");
assert(week2.mondayStr === "2026-11-02", "Monday's week starts on Monday 2026-11-02");
assert(week2.sundayStr === "2026-11-08", "Monday's week ends on Sunday 2026-11-08");

// 2026-11-08 is Sunday.
const week3 = getIsoWeekRange("2026-11-08");
assert(week3.mondayStr === "2026-11-02", "Sunday's week starts on Monday 2026-11-02");
assert(week3.sundayStr === "2026-11-08", "Sunday's week ends on Sunday 2026-11-08");

// Scenario 5: Streak calculation pure simulation
function calculateStreakFromDates(uniqueDates: string[], todayStr: string) {
  const activeDateSet = new Set(uniqueDates);
  const yesterdayStr = getPreviousDayString(todayStr);

  // Longest streak
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

  // Current streak
  const hasToday = activeDateSet.has(todayStr);
  const hasYesterday = activeDateSet.has(yesterdayStr);
  let currentStreak = 0;

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

  return { currentStreak, longestStreak, isStreakActiveToday: hasToday };
}

// 5a. New user (0 stories)
const r0 = calculateStreakFromDates([], "2026-11-06");
assert(r0.currentStreak === 0 && r0.longestStreak === 0 && !r0.isStreakActiveToday, "New user has 0 streak");

// 5b. User wrote 1 story today
const r1 = calculateStreakFromDates(["2026-11-06"], "2026-11-06");
assert(r1.currentStreak === 1 && r1.longestStreak === 1 && r1.isStreakActiveToday, "User published 1st story today -> 1 day streak");

// 5c. Multiple stories on same day
// (Note: uniqueDates is deduplicated)
const rMulti = calculateStreakFromDates(["2026-11-06"], "2026-11-06");
assert(rMulti.currentStreak === 1, "Multiple stories on same day counts as 1 active day");

// 5d. Consecutive days (yesterday + today)
const rConsec = calculateStreakFromDates(["2026-11-05", "2026-11-06"], "2026-11-06");
assert(rConsec.currentStreak === 2 && rConsec.longestStreak === 2 && rConsec.isStreakActiveToday, "Consecutive days yesterday + today -> 2 day streak");

// 5e. Wrote yesterday, but not today yet (Streak alive, waiting for today)
const rYesterday = calculateStreakFromDates(["2026-11-04", "2026-11-05"], "2026-11-06");
assert(rYesterday.currentStreak === 2 && !rYesterday.isStreakActiveToday, "Streak maintained from yesterday awaiting today");

// 5f. Missed yesterday and today
const rMissed = calculateStreakFromDates(["2026-11-01", "2026-11-02", "2026-11-03"], "2026-11-06");
assert(rMissed.currentStreak === 0 && rMissed.longestStreak === 3, "Missed days resets current streak to 0, preserves longest streak 3");

// 5g. Month change consecutive days
const rMonthCross = calculateStreakFromDates(["2026-10-30", "2026-10-31", "2026-11-01"], "2026-11-01");
assert(rMonthCross.currentStreak === 3 && rMonthCross.longestStreak === 3, "Month crossing streak is correctly 3");

// 5h. Year change consecutive days
const rYearCross = calculateStreakFromDates(["2025-12-30", "2025-12-31", "2026-01-01"], "2026-01-01");
assert(rYearCross.currentStreak === 3 && rYearCross.longestStreak === 3, "Year crossing streak is correctly 3");

console.log("\nALL STREAK & GOALS TESTS PASSED SUCCESSFULLY! ✨");

