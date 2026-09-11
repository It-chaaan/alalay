import { RecordActionSheet } from './record-action-sheet';
import type { ReactNode } from 'react';

type ItemManagementSheetProps = {
  visible: boolean;
  title: string;
  itemName: string;
  deleteDescription: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onToggleStatus?: () => Promise<void>;
  toggleStatusLabel?: string;
  toggleStatusIcon?: ReactNode;
  deleting?: boolean;
  error?: string;
};

/** Compatibility wrapper for existing Goal/Subscription callers. */
export function ItemManagementSheet({
  visible,
  title,
  itemName,
  deleteDescription,
  onClose,
  onEdit,
  onDelete,
  onToggleStatus,
  toggleStatusLabel = 'Pause',
  toggleStatusIcon,
}: ItemManagementSheetProps) {
  const isPauseAction = toggleStatusLabel.startsWith('Pause');
  const statusTone = isPauseAction ? 'warning' as const : 'primary' as const;
  return (
    <RecordActionSheet
      visible={visible}
      title={`${title} options`}
      recordName={itemName}
      onClose={onClose}
      actions={[
        {
          label: 'Edit',
          onPress: () => {
            onClose();
            onEdit();
          },
        },
        ...(onToggleStatus
          ? [
              {
                label: toggleStatusLabel,
                tone: statusTone,
                icon: toggleStatusIcon,
                onPress: onToggleStatus,
                confirm: {
                  title: isPauseAction
                    ? `Pause ${itemName} subscription?`
                    : `Resume ${itemName} subscription?`,
                  message:
                    isPauseAction
                      ? 'Renewal tracking and reminders will stop until you resume this subscription.'
                      : 'Renewal tracking and reminders will resume.',
                  confirmLabel: toggleStatusLabel,
                  cancelLabel: isPauseAction ? 'Keep subscription' : 'Keep paused',
                  loadingLabel: isPauseAction ? 'Pausing…' : 'Resuming…',
                  tone: statusTone,
                  icon: toggleStatusIcon,
                },
              },
            ]
          : []),
        {
          label: 'Delete',
          tone: 'destructive',
          onPress: onDelete,
          confirm: { title: `Delete ${itemName}?`, message: deleteDescription },
        },
      ]}
    />
  );
}
