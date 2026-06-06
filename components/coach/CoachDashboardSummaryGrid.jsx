import React from "react";
import CoachDesktopPerformanceCard from "./CoachDesktopPerformanceCard.jsx";
import CoachDesktopWeeklySummaryCard from "./CoachDesktopWeeklySummaryCard.jsx";
import CoachMobileKpiCard from "./CoachMobileKpiCard.jsx";
import CoachRecommendationCard from "./CoachRecommendationCard.jsx";

export default function CoachDashboardSummaryGrid({
  isMobile,
  mobileGap,
  desktopGap,
  recommendationProps,
  mobileWeekKpiProps,
  mobilePerformanceKpiProps,
  desktopWeeklyProps,
  desktopPerformanceProps,
}) {
  if (isMobile) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: mobileGap,
          alignItems: "stretch",
        }}
      >
        <CoachRecommendationCard {...recommendationProps} />
        <CoachMobileKpiCard {...mobileWeekKpiProps} />
        <CoachMobileKpiCard {...mobilePerformanceKpiProps} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr) minmax(240px, 1fr)",
        gap: desktopGap,
        alignItems: "stretch",
      }}
    >
      <CoachDesktopWeeklySummaryCard {...desktopWeeklyProps} />
      <CoachRecommendationCard {...recommendationProps} />
      <CoachDesktopPerformanceCard {...desktopPerformanceProps} />
    </div>
  );
}
