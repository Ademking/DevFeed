import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SHORTCUTS } from "@/lib/shortcuts";

export const ShortcutsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog onOpenChange={(d) => onOpenChange(d.open)} open={open}>
    <DialogContent size="sm">
      <DialogHeader title="Keyboard shortcuts" />
      <DialogBody>
        <dl className="flex flex-col divide-y">
          {SHORTCUTS.map((s) => (
            <div className="flex items-center justify-between gap-4 py-2" key={s.label}>
              <dt className="text-sm">{s.label}</dt>
              <dd className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogBody>
    </DialogContent>
  </Dialog>
);
