'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  checkBrowserCompatibility,
  getCompatibilityMessage,
  detectBrowser,
  type CompatibilityResult,
} from '@/lib/browser-compatibility';
import { AlertCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';

export function CompatibilityBanner() {
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<ReturnType<typeof detectBrowser> | null>(null);

  useEffect(() => {
    const result = checkBrowserCompatibility();
    const browser = detectBrowser();
    setCompatibility(result);
    setBrowserInfo(browser);

    // Auto-dismiss if fully compatible
    if (result.isCompatible && result.warnings.length === 0) {
      setDismissed(true);
    }
  }, []);

  if (!compatibility || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Determine alert variant and icon
  const getAlertVariant = () => {
    if (!compatibility.isCompatible) {
      return 'destructive';
    }
    if (compatibility.warnings.length > 0) {
      return 'default';
    }
    return 'default';
  };

  const getIcon = () => {
    if (!compatibility.isCompatible) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (compatibility.warnings.length > 0) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return <CheckCircle className="h-4 w-4" />;
  };

  const getTitle = () => {
    if (!compatibility.isCompatible) {
      return 'Browser Not Compatible';
    }
    if (compatibility.warnings.length > 0) {
      return 'Limited Compatibility';
    }
    return 'Browser Compatible';
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Alert variant={getAlertVariant()} className="relative">
        <div className="flex items-start gap-3">
          {getIcon()}
          <div className="flex-1">
            <AlertTitle className="mb-2">{getTitle()}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{getCompatibilityMessage(compatibility)}</p>

              {browserInfo && !browserInfo.isSupported && (
                <p className="text-sm">
                  Detected: {browserInfo.name} {browserInfo.version}
                </p>
              )}

              {compatibility.missingFeatures.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-sm mb-1">Missing Features:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {compatibility.missingFeatures.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {compatibility.warnings.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-sm mb-1">Warnings:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {compatibility.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!compatibility.isCompatible && (
                <div className="mt-3">
                  <p className="font-semibold text-sm mb-2">Recommended Browsers:</p>
                  <div className="flex flex-wrap gap-2">
                    {compatibility.recommendedBrowsers.map((browser) => (
                      <span
                        key={browser}
                        className="text-xs px-2 py-1 bg-background rounded border"
                      >
                        {browser}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1">
                    <a
                      href="https://www.google.com/chrome/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline block hover:no-underline"
                    >
                      Download Chrome
                    </a>
                    <a
                      href="https://www.microsoft.com/edge"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline block hover:no-underline"
                    >
                      Download Edge
                    </a>
                  </div>
                </div>
              )}
            </AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    </div>
  );
}
