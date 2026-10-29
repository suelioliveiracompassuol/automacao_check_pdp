'use client';

import { Card, Badge } from './ui/card';
import { FeatureTable } from './feature-table';
import { ScreenshotViewer } from './screenshot-viewer';
import { StepScreenshots } from './step-screenshots';
import { CountryFlag } from './ui/country-flag';
import { VendorLogo } from './vendor-logo';
import { featureRefUrls, type FeatureRefIndex } from '@/lib/feature-refs';
import { screenshotsForSku, summarizeFeatures } from '@/lib/report';
import type { PdpCheckResult } from '@/lib/types';
import { ChevronDown, ExternalLink, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { FaAndroid } from 'react-icons/fa';
import { m, AnimatePresence } from 'framer-motion';

interface PdpCardProps {
  result: PdpCheckResult;
  runId: string;
  screenshots: string[];
  /** Web only: shows the reference image column */
  featureRefs?: FeatureRefIndex;
}

export function PdpCard({ result, runId, screenshots, featureRefs }: PdpCardProps) {
  const [expanded, setExpanded] = useState(!result.success);
  const panelId = useId();

  const skuScreenshots = screenshotsForSku(screenshots, result.sku, result.pageScreenshot);

  const { percentage: passPercentage } = summarizeFeatures(result.features);

  return (
    <Card
      className={`border-l-4 overflow-hidden transition-all duration-200 hover:shadow-md ${
        result.success
          ? 'border-l-success hover:border-l-success'
          : 'border-l-alert hover:border-l-alert'
      }`}
    >
      {/* WAI accordion pattern: heading wraps the disclosure button */}
      <h3>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="w-full text-left cursor-pointer rounded-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  result.success ? 'bg-success-lightest' : 'bg-alert-lightest'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-success" role="img" aria-label="Aprovado" />
                ) : (
                  <XCircle className="h-5 w-5 text-alert" role="img" aria-label="Reprovado" />
                )}
              </div>
              <div className="min-w-0">
                <span className="block font-semibold text-highlight truncate text-sm">
                  {result.name}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-medium-emphasis font-mono bg-neutral-50 px-1.5 py-0.5 rounded">
                    {result.sku}
                  </span>
                  {result.loadTime && (
                    <span className="flex items-center gap-0.5 text-xs text-low-emphasis">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {result.loadTime}ms
                    </span>
                  )}
                  <span className="text-xs text-low-emphasis">{passPercentage}% features ok</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {result.platform === 'android' && (
                <Badge className="flex items-center gap-1 bg-success-lightest/50 text-success-dark border border-success-light/60 font-semibold">
                  <FaAndroid className="w-3 h-3" /> Android
                </Badge>
              )}
              {result.channel === 'socialcommerce' && (
                <Badge className="bg-info-lightest/50 text-info-dark border border-info-light/60 font-semibold">
                  Minha Loja
                </Badge>
              )}
              <VendorLogo vendor={result.vendor} />
              <Badge className="bg-neutral-50 text-high-emphasis border border-neutral-100">
                <CountryFlag code={result.country} width={16} height={12} className="mr-1" />
                {result.country.toUpperCase()}
              </Badge>
              <ChevronDown
                aria-hidden="true"
                className={`w-4 h-4 text-low-emphasis transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </button>
      </h3>

      <AnimatePresence>
        {expanded && (
          <m.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-neutral-75 space-y-3">
              <div className="flex items-center gap-2 text-xs text-medium-emphasis">
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-darkest hover:text-primary-darkest hover:underline break-all transition-colors"
                >
                  {result.url}
                </a>
              </div>

              {result.error && (
                <div className="flex items-start gap-2 bg-alert-lightest/50 text-alert-dark text-sm px-3 py-2.5 rounded-lg border border-alert-lightest">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{result.error}</span>
                </div>
              )}

              <FeatureTable
                features={result.features}
                runId={runId}
                pageScreenshot={result.pageScreenshot}
                featureRefs={featureRefs && featureRefUrls(featureRefs, result)}
              />

              {result.stepScreenshots && (
                <StepScreenshots steps={result.stepScreenshots} runId={runId} />
              )}

              <ScreenshotViewer screenshots={skuScreenshots} runId={runId} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
