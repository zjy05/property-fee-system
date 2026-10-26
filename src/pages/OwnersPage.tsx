import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import OwnersTab from '@/pages/LedgerPage/sections/OwnersTab';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

export default function OwnersPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Users className="size-5" /> 业主档案
          {!isAdmin(getCurrentUser()) && <Badge variant="outline">只读</Badge>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          楼栋 / 单元 / 房号分开维护，支持 Excel 批量导入；业主档案是收费台账的户主来源。
        </p>
      </div>
      <OwnersTab />
    </div>
  );
}
