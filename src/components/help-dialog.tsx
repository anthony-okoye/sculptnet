'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SculptNet Guide</DialogTitle>
          <DialogDescription>
            Learn how to sculpt AI-generated images with hand gestures
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="gestures" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gestures">Gestures</TabsTrigger>
            <TabsTrigger value="shortcuts">Keyboard Shortcuts</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="gestures" className="space-y-4 mt-4">
            <GestureCard
              title="Pinch Gesture"
              description="Control camera field of view (FOV)"
              icon="🤏"
              instructions={[
                'Bring your thumb and index finger together',
                'Pinch closer for narrow FOV (telephoto lens)',
                'Spread wider for wide FOV (wide-angle lens)',
                'Range: 35° to 120°',
              ]}
              parameter="photographic_characteristics.lens_focal_length"
            />

            <GestureCard
              title="Wrist Rotation"
              description="Adjust camera angle"
              icon="🔄"
              instructions={[
                'Rotate your wrist left or right',
                'Left rotation: Low angle / Dutch tilt',
                'Center: Eye level',
                'Right rotation: High angle / Bird\'s eye view',
              ]}
              parameter="photographic_characteristics.camera_angle"
            />

            <GestureCard
              title="Vertical Movement"
              description="Change lighting conditions"
              icon="☝️"
              instructions={[
                'Move your hand up and down',
                'Low position: Night / Moonlight',
                'Mid-low: Golden hour',
                'Mid-high: Soft volumetric lighting',
                'High: Bright studio lighting',
              ]}
              parameter="lighting.conditions"
            />

            <GestureCard
              title="Two-Hand Frame"
              description="Set composition style"
              icon="🖼️"
              instructions={[
                'Use both hands to create a frame',
                'Centered frame: Subject centered',
                'Off-center: Rule of thirds',
                'Wide frame: Panoramic composition',
              ]}
              parameter="aesthetics.composition"
            />

            <GestureCard
              title="Fist to Open"
              description="Trigger image generation"
              icon="✊➡️🖐️"
              instructions={[
                'Make a fist with your hand',
                'Quickly open your hand',
                'This triggers generation with current parameters',
                'Wait for generation to complete (5-15 seconds)',
              ]}
              parameter="Generation Trigger"
            />

            <GestureCard
              title="Preset Gestures"
              description="Quick style shortcuts"
              icon="✌️"
              instructions={[
                '✌️ Peace sign: Cinematic, dramatic lighting',
                '👍 Thumbs up: Bright, optimistic style',
                '🤘 Rock sign: Edgy, high contrast',
              ]}
              parameter="Multiple parameters"
            />
          </TabsContent>

          <TabsContent value="shortcuts" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Keyboard Shortcuts</CardTitle>
                <CardDescription>Speed up your workflow with these shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ShortcutRow shortcut="Space" description="Start/Stop hand tracking" />
                <ShortcutRow shortcut="G" description="Generate image manually" />
                <ShortcutRow shortcut="E" description="Open JSON editor" />
                <ShortcutRow shortcut="C" description="Toggle compare mode" />
                <ShortcutRow shortcut="H" description="Toggle parameter HUD" />
                <ShortcutRow shortcut="?" description="Show this help dialog" />
                <ShortcutRow shortcut="Esc" description="Close dialogs" />
                <ShortcutRow shortcut="Ctrl/Cmd + S" description="Export current image" />
                <ShortcutRow shortcut="Ctrl/Cmd + Z" description="Undo last parameter change" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tips" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>1. <strong>Allow webcam access</strong> when prompted by your browser</p>
                <p>2. <strong>Position yourself</strong> 1-2 feet from the camera with good lighting</p>
                <p>3. <strong>Start tracking</strong> by clicking the Start button or pressing Space</p>
                <p>4. <strong>Practice gestures</strong> and watch the parameter HUD for feedback</p>
                <p>5. <strong>Generate images</strong> with the fist-to-open gesture</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>• <strong>Smooth movements:</strong> Make gradual gestures for better control</p>
                <p>• <strong>Hold steady:</strong> Pause briefly when you reach desired values</p>
                <p>• <strong>Good lighting:</strong> Ensure your hands are well-lit for accurate tracking</p>
                <p>• <strong>Clear background:</strong> Avoid cluttered backgrounds behind your hands</p>
                <p>• <strong>One hand at a time:</strong> Use single-hand gestures unless framing</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Troubleshooting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>• <strong>Gestures not detected?</strong> Check webcam permissions and lighting</p>
                <p>• <strong>Jittery parameters?</strong> Move more slowly and deliberately</p>
                <p>• <strong>Generation fails?</strong> Check your API key in settings</p>
                <p>• <strong>Slow performance?</strong> Close other browser tabs and applications</p>
                <p>• <strong>AR not working?</strong> Ensure you're using HTTPS and a supported browser</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Browser Compatibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>✅ <strong>Chrome/Edge:</strong> Full support (recommended)</p>
                <p>✅ <strong>Firefox:</strong> Full support</p>
                <p>⚠️ <strong>Safari:</strong> Limited WebXR support</p>
                <p>✅ <strong>Mobile:</strong> Works on iOS Safari and Chrome Android</p>
                <p className="text-sm text-muted-foreground mt-4">
                  Requires: WebRTC (webcam), WebGL 2.0, JavaScript enabled
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button onClick={() => onOpenChange(false)}>Got it!</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GestureCardProps {
  title: string;
  description: string;
  icon: string;
  instructions: string[];
  parameter: string;
}

function GestureCard({ title, description, icon, instructions, parameter }: GestureCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{icon}</span>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1 list-disc list-inside">
          {instructions.map((instruction, index) => (
            <li key={index} className="text-sm">
              {instruction}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 pt-2">
          <Badge variant="secondary" className="text-xs">
            {parameter}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

interface ShortcutRowProps {
  shortcut: string;
  description: string;
}

function ShortcutRow({ shortcut, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm">{description}</span>
      <Badge variant="outline" className="font-mono">
        {shortcut}
      </Badge>
    </div>
  );
}

// Hook to manage first-time help dialog display
export function useFirstTimeHelp() {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenGuide');
    if (!hasSeenGuide) {
      setShowHelp(true);
      localStorage.setItem('hasSeenGuide', 'true');
    }
  }, []);

  return { showHelp, setShowHelp };
}
