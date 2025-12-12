'use client';

/**
 * JSON Prompt Editor Component
 * 
 * A dialog-based editor for viewing and modifying the FIBO structured prompt.
 * Features:
 * - Displays current prompt from Zustand store
 * - Validates JSON against FIBO Zod schema
 * - Shows validation errors with field names
 * - Apply/Cancel buttons for changes
 * - Toast notifications for success/error
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePromptStore } from '@/lib/stores/prompt-store';
import { validateFIBOPrompt, type ValidationError } from '@/types/fibo';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Code2 } from 'lucide-react';

interface PromptEditorProps {
  /** Optional trigger element. If not provided, uses default button */
  trigger?: React.ReactNode;
  /** Callback when prompt is successfully updated */
  onPromptUpdated?: () => void;
}

/**
 * PromptEditor Component
 * 
 * Provides a dialog interface for editing the FIBO structured prompt JSON.
 */
export function PromptEditor({ trigger, onPromptUpdated }: PromptEditorProps) {
  // Dialog open state
  const [open, setOpen] = useState(false);
  
  // Editor content state
  const [editorContent, setEditorContent] = useState('');
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  
  // Prompt store
  const promptStore = usePromptStore();


  /**
   * Populate editor with current prompt when dialog opens
   * Requirements: 6.1
   */
  useEffect(() => {
    if (open) {
      const currentPrompt = promptStore.export();
      setEditorContent(currentPrompt);
      setValidationErrors([]);
      setIsValid(null);
    }
  }, [open, promptStore]);

  /**
   * Validate the current editor content against FIBO schema
   * Requirements: 6.2
   */
  const handleValidate = useCallback(() => {
    try {
      const parsed = JSON.parse(editorContent);
      const result = validateFIBOPrompt(parsed);
      
      setValidationErrors(result.errors);
      setIsValid(result.success);
      
      if (result.success) {
        toast.success('JSON is valid', {
          description: 'The prompt passes all schema validations.',
        });
      } else {
        toast.error('Validation failed', {
          description: `Found ${result.errors.length} error(s) in the prompt.`,
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Invalid JSON syntax';
      setValidationErrors([{ path: 'root', message: `JSON parse error: ${error}` }]);
      setIsValid(false);
      toast.error('Invalid JSON', {
        description: 'The content is not valid JSON syntax.',
      });
    }
  }, [editorContent]);

  /**
   * Apply the edited prompt if valid
   * Requirements: 6.3, 6.4
   */
  const handleApply = useCallback(() => {
    // First validate
    try {
      const parsed = JSON.parse(editorContent);
      const result = validateFIBOPrompt(parsed);
      
      if (!result.success) {
        setValidationErrors(result.errors);
        setIsValid(false);
        toast.error('Cannot apply invalid prompt', {
          description: 'Please fix validation errors before applying.',
        });
        return;
      }
      
      // Import the valid prompt
      const importResult = promptStore.import(editorContent);
      
      if (importResult.success) {
        toast.success('Prompt updated', {
          description: 'Your changes have been applied successfully.',
        });
        setOpen(false);
        onPromptUpdated?.();
      } else {
        toast.error('Failed to apply prompt', {
          description: importResult.error || 'Unknown error occurred.',
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Invalid JSON syntax';
      setValidationErrors([{ path: 'root', message: `JSON parse error: ${error}` }]);
      setIsValid(false);
      toast.error('Invalid JSON', {
        description: 'The content is not valid JSON syntax.',
      });
    }
  }, [editorContent, promptStore, onPromptUpdated]);

  /**
   * Cancel and close dialog without changes
   * Requirements: 6.5
   */
  const handleCancel = useCallback(() => {
    setOpen(false);
    // State will be reset when dialog opens again
  }, []);

  /**
   * Handle editor content change
   */
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
    // Reset validation state when content changes
    setIsValid(null);
    setValidationErrors([]);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Code2 className="mr-2 h-4 w-4" />
            Edit JSON
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit FIBO Prompt</DialogTitle>
          <DialogDescription>
            View and edit the structured JSON prompt. Changes will be validated against the FIBO schema.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* JSON Editor */}
          <div className="flex-1 min-h-0">
            <Textarea
              value={editorContent}
              onChange={handleContentChange}
              className="h-[300px] font-mono text-sm resize-none"
              placeholder="Loading prompt..."
              spellCheck={false}
            />
          </div>
          
          {/* Validation Status */}
          {isValid !== null && (
            <Alert variant={isValid ? 'default' : 'destructive'}>
              {isValid ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {isValid ? 'Valid JSON' : 'Validation Errors'}
              </AlertTitle>
              <AlertDescription>
                {isValid ? (
                  'The prompt is valid and ready to apply.'
                ) : (
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="text-sm">
                        <span className="font-medium">{error.path || 'root'}</span>: {error.message}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleValidate}>
            Validate
          </Button>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isValid === false}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PromptEditor;
