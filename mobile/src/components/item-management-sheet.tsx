import { RecordActionSheet } from './record-action-sheet';

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
}: ItemManagementSheetProps) {
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
                onPress: onToggleStatus,
                confirm: {
                  title: `${toggleStatusLabel} ${itemName}?`,
                  message:
                    toggleStatusLabel === 'Pause'
                      ? 'Renewal tracking and reminders will stop until you resume it.'
                      : 'Renewal tracking and reminders will resume.',
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
