# `src/modules/admin/services/admin.service.ts`

## Role

**Dashboard backend** for admin/support: app version management, admin login (email/password vs SuperAdmin), password reset OTP, email verification, staff CRUD, menu permissions, support roles, support staff, drivers list/detail/verification, document upload and verification, vehicle types, subscriptions, promoters, NID/numberplate lookups, BD vehicle type list, and many document pipelines for **manual review** workflows.

## Major areas

| Area | Representative methods |
|------|------------------------|
| Auth | `login`, `sendResetPasswordOtp`, `resetPassword`, `verifyEmail`, `createAdmin`, `getUserInfo` |
| Staff | `getStaffList`, `deleteStaff`, `editStaff` |
| Permissions | `getMenuPermissions`, `editMenuPermissions`, `deleteMenuPermissions` |
| Support roles | `getSupportRoles`, `createSupportRole`, `editSupportRole`, `deleteSupportRole`, `createSupportStuff`, `getSupportStuffs` |
| Drivers | `getDriverList`, `getDriverDetails`, `getDriverVerification`, `getDriverDocument`, `verifyDriver`, `driverDocumentsUpload` |
| Catalog | `getVehicleTypes`, `getVehicleTypesListBD`, `createSubscriptionType`, `getSubscriptionTypes`, `updateSubscriptionType` |
| Promoters | `promoterDocumentsUpload`, `getPromoterProfile`, `getPromoterList` |
| App | `updateAppVersion`, `getAppVersion` |

## Private helpers

Includes `maskPhone`, document update helpers, Azure delete orchestration — see source for full list.

## Notes

- Very large service; pair with `admin.controller.ts` for route mapping.
