"use client";

import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "convex/react";
import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { PortalPageState } from "./PortalPageState";

const money = (minor: number, locale: "bn" | "en") =>
  new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(minor / 100);
const monthName = (key: string, locale: "bn" | "en") => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, 1));
};

export function StudentFinance({ locale }: { locale: "bn" | "en" }) {
  const data = useQuery(api.fees.functions.myFees, {});
  const bn = locale === "bn";
  if (data === undefined)
    return <PortalPageState state="loading" locale={locale} />;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1>{bn ? "ফি ও রশিদ" : "Fees & receipts"}</h1>
        <p className="text-muted-foreground">
          {bn
            ? "আপনার বর্তমান বকেয়া, অগ্রিম পরিশোধিত মাস এবং সংগ্রহের ইতিহাস।"
            : "Your current dues, future paid months, and collection history."}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>{bn ? "এখন বকেয়া" : "Due now"}</CardDescription>
            <CardTitle className="font-mono text-destructive">
              {money(data.dueMinor, locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.dueMonths.length ? (
              data.dueMonths.map((key) => (
                <Badge key={key} variant="danger">
                  {monthName(key, locale)}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">
                {bn ? "কোনো বকেয়া নেই" : "No fees due"}
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>
              {bn ? "ভবিষ্যৎ পরিশোধিত" : "Future paid"}
            </CardDescription>
            <CardTitle>{data.futurePaidMonths.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.futurePaidMonths.length ? (
              data.futurePaidMonths.map((key) => (
                <Badge key={key}>{monthName(key, locale)}</Badge>
              ))
            ) : (
              <span className="text-muted-foreground">
                {bn ? "কোনো ভবিষ্যৎ মাস পরিশোধিত নেই" : "No future months paid"}
              </span>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{bn ? "সংগ্রহের ইতিহাস" : "Collection history"}</CardTitle>
          <CardDescription>
            {bn
              ? "রশিদ ইংরেজিতে তৈরি হয়।"
              : "Receipts are generated in English."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.collections.length === 0 ? (
            <EmptyState
              title={bn ? "এখনও কোনো সংগ্রহ নেই" : "No collections yet"}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{bn ? "তারিখ" : "Date"}</TableHead>
                    <TableHead>{bn ? "বিবরণ" : "Description"}</TableHead>
                    <TableHead className="text-right">
                      {bn ? "পরিমাণ" : "Amount"}
                    </TableHead>
                    <TableHead>{bn ? "অবস্থা" : "Status"}</TableHead>
                    <TableHead>{bn ? "রশিদ" : "Receipt"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.collections.map((row) => (
                    <TableRow key={row.collectionId}>
                      <TableCell>{row.collectedOn}</TableCell>
                      <TableCell>{row.summary}</TableCell>
                      <TableCell className="text-right font-mono">
                        {money(row.amountMinor, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                              row.status === "posted" ? "success" : "neutral"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="secondary" size="sm" asChild>
                          <Link
                            href={`/${locale}/student/receipt/${row.collectionId}`}
                          >
                            <ReceiptText data-icon="inline-start" />
                            {bn ? "দেখুন" : "View"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
