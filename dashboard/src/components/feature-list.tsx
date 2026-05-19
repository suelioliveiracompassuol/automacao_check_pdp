import React, { useState } from "react";
import { FeatureResult } from "@/types/report";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Star,
} from "lucide-react";
import clsx from "clsx";

interface FeatureListProps {
  features: FeatureResult[];
}

export function FeatureList({ features }: FeatureListProps) {
  const [isReviewsOpen, setIsReviewsOpen] = useState(true);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="text-green-500" size={18} />;
      case "fail":
        return <XCircle className="text-red-500" size={18} />;
      case "warning":
        return <AlertTriangle className="text-orange-500" size={18} />;
      case "skip":
        return <Info className="text-gray-400" size={18} />;
      default:
        return <Info className="text-gray-400" size={18} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "pass":
        return "bg-green-50 border-green-100";
      case "fail":
        return "bg-red-50 border-red-100";
      case "warning":
        return "bg-orange-50 border-orange-100";
      case "skip":
        return "bg-gray-50 border-gray-100";
      default:
        return "bg-gray-50 border-gray-100";
    }
  };

  // Group review-related features
  const reviewFeatureKeys = [
    "reviews",
    "reviewFilter",
    "reviewSort",
    "reviewPhotos",
    "reviewRecommendation",
    "rating",
    "endpoint_reviews",
  ];

  const reviewFeatures = features.filter((f) =>
    reviewFeatureKeys.includes(f.featureKey),
  );
  const otherFeatures = features.filter(
    (f) => !reviewFeatureKeys.includes(f.featureKey),
  );

  // Determine overall status for reviews group
  const hasReviewFailures = reviewFeatures.some((f) => f.status === "fail");
  const hasReviewWarnings = reviewFeatures.some((f) => f.status === "warning");
  const reviewsGroupStatus = hasReviewFailures
    ? "fail"
    : hasReviewWarnings
      ? "warning"
      : "pass";

  const renderFeatureRow = (
    feature: FeatureResult,
    index: number,
    isChild = false,
  ) => (
    <div
      key={`${feature.featureKey}-${index}`}
      className={clsx(
        "p-2 rounded-lg border flex flex-col justify-between",
        getStatusClass(feature.status),
        isChild && "ml-6 border-l-4 border-l-gray-300",
      )}
    >
      <div className="flex gap-2 items-center">
        <div className="ml-2 shrink-0">{getStatusIcon(feature.status)}</div>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <h4 className="font-medium text-gray-900 text-sm min-w-50">
              {feature.feature}
            </h4>
            <p className="text-sm text-gray-600">{feature.message}</p>
          </div>
          <div>
            {feature.screenshot && (
              <button
                className="flex items-center space-x-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                onClick={() => {
                  const basePath =
                    process.env.NODE_ENV === "production" ? "." : "..";
                  window.open(`${basePath}/${feature.screenshot}`, "_blank");
                }}
                title="Ver Screenshot"
              >
                <ImageIcon size={14} />
                <span>Screenshot</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-2">
      {/* Reviews Accordion */}
      {reviewFeatures.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => setIsReviewsOpen(!isReviewsOpen)}
            className={clsx(
              "w-full p-3 flex items-center justify-between transition-colors",
              getStatusClass(reviewsGroupStatus),
            )}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(reviewsGroupStatus)}
              <div className="flex items-center gap-2">
                <Star className="text-yellow-500" size={18} />
                <h4 className="font-semibold text-gray-900">
                  Avaliações & Rating
                </h4>
              </div>
              <span className="text-sm text-gray-500">
                ({reviewFeatures.filter((f) => f.status === "pass").length}/
                {reviewFeatures.length} ok)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {hasReviewFailures
                  ? "Falhas encontradas"
                  : hasReviewWarnings
                    ? "Avisos encontrados"
                    : "Todas as sub-features ok"}
              </span>
              {isReviewsOpen ? (
                <ChevronUp size={20} className="text-gray-500" />
              ) : (
                <ChevronDown size={20} className="text-gray-500" />
              )}
            </div>
          </button>

          {isReviewsOpen && (
            <div className="p-3 bg-gray-50/50 flex flex-col gap-2 border-t">
              {reviewFeatures.map((feature, index) =>
                renderFeatureRow(feature, index, true),
              )}
            </div>
          )}
        </div>
      )}

      {/* Other Features */}
      {otherFeatures.map((feature, index) => renderFeatureRow(feature, index))}
    </div>
  );
}
