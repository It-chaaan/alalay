import { RecordActionSheet } from './record-action-sheet';

type ItemManagementSheetProps = {
  visible: boolean;
  title: string;
  itemName: string;
  deleteDescription: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  deleting?: boolean;
  error?: string;
};

/** Compatibility wrapper for existing Goal/Subscription callers. */
export function ItemManagementSheet({ visible, title, itemName, deleteDescription, onClose, onEdit, onDelete }: ItemManagementSheetProps) {
  return <RecordActionSheet visible={visible} title={`${title} options`} recordName={itemName} onClose={onClose} actions={[
    { label: 'Edit', onPress: () => { onClose(); onEdit(); } },
    { label: 'Delete', tone: 'destructive', onPress: onDelete, confirm: { title: `Delete ${itemName}?`, message: deleteDescription } },
  ]} />;
}
