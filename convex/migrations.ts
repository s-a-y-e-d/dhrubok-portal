import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfillCourseSearchText = migrations.define({
  table: "courses",
  migrateOne: async (_ctx, course) => course.searchText ? undefined : ({ searchText: `${course.code} ${course.nameBn} ${course.nameEn}`.trim().toLowerCase() }),
});

export const clearBatchRooms = migrations.define({ table: "batches", migrateOne: async (_ctx, row) => row.roomBn === undefined && row.roomEn === undefined ? undefined : ({ roomBn: undefined, roomEn: undefined }) });
export const clearBatchScheduleRooms = migrations.define({ table: "batchSchedules", migrateOne: async (_ctx, row) => row.roomBn === undefined && row.roomEn === undefined ? undefined : ({ roomBn: undefined, roomEn: undefined }) });
export const clearClassSessionRooms = migrations.define({ table: "classSessions", migrateOne: async (_ctx, row) => row.roomBn === undefined && row.roomEn === undefined ? undefined : ({ roomBn: undefined, roomEn: undefined }) });
