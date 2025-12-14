import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Settings, SquarePen, Trash2 } from "lucide-react";
import { useState } from "react";

interface EntityActionMenuProps {
  entityType: "project" | "meeting" | "series" | "point";
  entityName: string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  showDeleteConfirm?: boolean;
  onShowDeleteConfirmChange?: (show: boolean) => void;
}

export default function EntityActionMenu({
  entityType,
  entityName,
  onEdit,
  onDelete,
  isDeleting = false,
  showDeleteConfirm,
  onShowDeleteConfirmChange,
}: EntityActionMenuProps) {
  const [internalShowDialog, setInternalShowDialog] = useState(false);
  
  const isControlled = showDeleteConfirm !== undefined && onShowDeleteConfirmChange !== undefined;
  const showDeleteDialog = isControlled ? showDeleteConfirm : internalShowDialog;
  const setShowDeleteDialog = isControlled ? onShowDeleteConfirmChange : setInternalShowDialog;

  const entityLabels = {
    project: "Project",
    meeting: "Meeting",
    series: "Meeting Series",
    point: "Point",
  };

  const deleteWarnings = {
    project: "This will also delete all meetings and points associated with this project.",
    meeting: "This will also delete all points and attendees associated with this meeting.",
    series: "This will also delete all occurrences, points, and attendees associated with this series.",
    point: "This will also delete all status updates and attachments for this point.",
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-action-menu-${entityType}`}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-${entityType}`}>
            <SquarePen className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
            data-testid={`button-delete-${entityType}`}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entityLabels[entityType]}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{entityName}"? {deleteWarnings[entityType]}
              <br /><br />
              <span className="font-medium text-destructive">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              data-testid="button-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
