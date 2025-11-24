/**
 * EditUserRoleModal Component
 * Modal for changing a user's role
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { updateTeamMemberRole, TeamMember } from '@/lib/client-portal/teamService';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface EditUserRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSuccess?: () => void;
}

export function EditUserRoleModal({ open, onOpenChange, member, onSuccess }: EditUserRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<'executive' | 'user'>(member.role_within_client);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (selectedRole === member.role_within_client) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTeamMemberRole(member.user_id, selectedRole);
      toast({
        title: 'Role updated',
        description: `${member.first_name} ${member.last_name} is now a${selectedRole === 'executive' ? 'n' : ''} ${selectedRole}`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogDescription>
            Update the role for {member.first_name} {member.last_name}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup value={selectedRole} onValueChange={(value) => setSelectedRole(value as 'executive' | 'user')}>
            <div className="flex items-start space-x-3 rounded-lg border p-4 mb-3">
              <RadioGroupItem value="executive" id="role-executive" />
              <div className="space-y-1">
                <Label htmlFor="role-executive" className="cursor-pointer">Executive</Label>
                <p className="text-xs text-gray-600">
                  Full access to all features, can manage team and approve orders
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="user" id="role-user" />
              <div className="space-y-1">
                <Label htmlFor="role-user" className="cursor-pointer">User</Label>
                <p className="text-xs text-gray-600">
                  Configurable permissions, limited access based on settings
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
