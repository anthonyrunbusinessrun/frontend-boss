import { AlignLeft, Calendar, CircleChevronDown, Hash, Link2, ListChecks, Mail, Paperclip, Phone, SquareCheck, SquareFunction, Type, Globe, ListOrdered } from "lucide-react";
import type { FieldType } from "@/lib/base/types";

export function FieldTypeIcon({ type, size = 14 }: { type: FieldType; size?: number }) {
  const p = { size, strokeWidth: 1.75, "aria-hidden": true } as const;
  switch (type) {
    case "longText": return <AlignLeft {...p} />;
    case "number": return <Hash {...p} />;
    case "autonumber": return <ListOrdered {...p} />;
    case "date": return <Calendar {...p} />;
    case "checkbox": return <SquareCheck {...p} />;
    case "singleSelect": return <CircleChevronDown {...p} />;
    case "multiSelect": return <ListChecks {...p} />;
    case "attachment": return <Paperclip {...p} />;
    case "url": return <Globe {...p} />;
    case "email": return <Mail {...p} />;
    case "phone": return <Phone {...p} />;
    case "link": return <Link2 {...p} />;
    case "computed": return <SquareFunction {...p} />;
    default: return <Type {...p} />;
  }
}
