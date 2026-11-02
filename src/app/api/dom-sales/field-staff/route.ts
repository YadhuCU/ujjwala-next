import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatResponse } from "@/lib/response";
import * as DomSaleService from "@/module/dom-sale/dom-sale.service";

// The domestic sale form's field staff dropdown. Only someone who records
// rounds for other people needs the list, so it takes the agency-wide scope —
// and it does not need user.read, which the office usually lacks.
export async function GET() {
  return withAuth(async () => {
    const staff = await DomSaleService.getFieldStaff();
    return formatResponse({ data: staff });
  }, [PERMISSIONS.DOMESTIC_SALE_CREATE, PERMISSIONS.DOMESTIC_SALE_READ_ALL]);
}
