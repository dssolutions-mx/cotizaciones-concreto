/**
 * DeactivateUserDialog Component
 * Confirmation dialog for deactivating a team member
 */

'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { deactivateTeamMember, TeamMember } from '@/lib/client-portal/teamService';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface DeactivateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSuccess?: () => void;
}

export function DeactivateUserDialog({ open, onOpenChange, member, onSuccess }: DeactivateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    try {
      await deactivateTeamMember(member.user_id);
      toast({
        title: 'User deactivated',
        description: `${member.first_name} ${member.last_name} has been deactivated and can no longer access the portal`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to deactivate user',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate Team Member?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate <strong>{member.first_name} {member.last_name}</strong>?
            <br /><br />
            They will lose access to the client portal immediately. You can reactivate them later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeactivate} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Deactivate User
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
