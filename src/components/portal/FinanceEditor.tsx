"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { useSearchParams } from "next/navigation";
import { BillingSetup } from "./BillingSetup";
import {
  Search,
  DollarSign,
  Settings,
  Bell,
  Printer,
  User,
  AlertTriangle,
  Check,
  X,
  CreditCard,
  PlusCircle,
  AlertCircle,
} from "lucide-react";

const toMinor = (value: string | number) => Math.round(Number(value) * 100);

export function FinanceEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const paramStudentId = searchParams?.get("student") || "";
  const paramAction = searchParams?.get("action") || "";

  // Tabs: collect (Collect & Adjust), config (Plans & Billing Run), reminders (Due Reminders)
  const [activeTab, setActiveTab] = useState<
    "collect" | "config" | "reminders"
  >("collect");

  // Sync active tab based on params
  useEffect(() => {
    if (paramAction === "collect" || paramStudentId) {
      const timeoutId = setTimeout(() => setActiveTab("collect"), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [paramAction, paramStudentId]);

  // Student list (default page) & selected student ID
  const students = useQuery(api.students.owner.listStudents, {
    status: "active",
    paginationOpts: { numItems: 100, cursor: null },
  });
  const [studentId, setStudentId] = useState<Id<"students"> | "">("");

  // Search states for combobox
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useQuery(
    api.students.owner.searchStudentsForOwner,
    debouncedSearchQuery.trim().length >= 2
      ? { queryText: debouncedSearchQuery }
      : "skip",
  );

  // Fallback to active students if query is short
  const displayStudents =
    debouncedSearchQuery.trim().length >= 2
      ? (searchResults ?? [])
      : (students?.page ?? []);

  // Sync selected student from search params
  useEffect(() => {
    if (!students) return;
    const matchingStudent = students.page.find(
      (student: { studentId: string }) => student.studentId === paramStudentId,
    );
    const targetId = matchingStudent
      ? matchingStudent.studentId
      : paramStudentId
        ? (paramStudentId as Id<"students">)
        : "";
    if (targetId) {
      const timeoutId = setTimeout(() => setStudentId(targetId), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [students, paramStudentId]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Selected student details, charges, payments, and financial summary
  const student = useQuery(
    api.students.owner.getStudent,
    studentId ? { studentId } : "skip",
  );
  const charges = useQuery(
    api.finance.functions.listCharges,
    studentId
      ? { studentId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  );
  const payments = useQuery(
    api.finance.functions.listPayments,
    studentId
      ? { studentId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  );
  const summary = useQuery(
    api.finance.functions.getStudentSummary,
    studentId ? { studentId } : "skip",
  );

  // Due reminders list & mutations
  const due = useQuery(api.finance.functions.duePreview, {});
  const collect = useMutation(api.finance.functions.collectPayment);
  const customCharge = useMutation(api.finance.functions.createCustomCharge);
  const voidPayment = useMutation(api.finance.functions.voidPayment);
  const remind = useMutation(api.finance.functions.sendDueReminders);

  // Forms state
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
    paymentId?: Id<"payments">;
    studentId?: Id<"students">;
  } | null>(null);
  const [voidTarget, setVoidTarget] = useState<Id<"payments"> | "">("");
  const [voidReason, setVoidReason] = useState("");
  const [confirmingReminders, setConfirmingReminders] = useState(false);

  // Payment Collection state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bkash" | "nagad" | "bank_transfer" | "cheque" | "other"
  >("cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toLocaleDateString("en-CA"),
  ); // YYYY-MM-DD
  const [checkedCharges, setCheckedCharges] = useState<Record<string, boolean>>(
    {},
  );

  // Reset checked charges and payment input when student changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNote("");
      setFeedback(null);
      setVoidTarget("");
      if (charges?.page) {
        const initial: Record<string, boolean> = {};
        charges.page.forEach((c) => {
          if (
            c.status !== "paid" &&
            c.status !== "voided" &&
            c.netAmountMinor > c.paidAmountMinor
          ) {
            initial[c.chargeId] = true;
          }
        });
        setCheckedCharges(initial);
      } else {
        setCheckedCharges({});
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [studentId, charges]);

  if (!students || due === undefined)
    return <PortalPageState state="loading" locale={locale} />;

  async function execute(work: () => Promise<unknown>) {
    setBusy(true);
    setFeedback(null);
    try {
      await work();
      setFeedback({
        ok: true,
        text: bn ? "অপারেশন সম্পন্ন হয়েছে।" : "Operation completed.",
      });
      return true;
    } catch (cause) {
      setFeedback({
        ok: false,
        text: cause instanceof Error ? cause.message : "Operation failed",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Formatting helper
  const formatMoney = (minor: number) => {
    return (
      "৳ " +
      (minor / 100).toLocaleString(locale === "bn" ? "bn-BD" : "en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Outstanding charges calculation and sorting
  const unpaidCharges = charges?.page
    ? [...charges.page]
        .filter(
          (c) =>
            c.status !== "paid" &&
            c.status !== "voided" &&
            c.netAmountMinor > c.paidAmountMinor,
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)) // Oldest first
    : [];

  const amountVal = Number(paymentAmount) || 0;
  const amountMinor = Math.round(amountVal * 100);

  let remainingPayment = amountMinor;
  const computedAllocations: Array<{
    chargeId: Id<"studentCharges">;
    chargeNumber: string;
    description: string;
    amountMinor: number;
  }> = [];

  for (const charge of unpaidCharges) {
    if (remainingPayment <= 0) break;
    if (checkedCharges[charge.chargeId]) {
      const chargeBalance = charge.netAmountMinor - charge.paidAmountMinor;
      const allocated = Math.min(remainingPayment, chargeBalance);
      computedAllocations.push({
        chargeId: charge.chargeId,
        chargeNumber: charge.chargeNumber,
        description: charge.description,
        amountMinor: allocated,
      });
      remainingPayment -= allocated;
    }
  }
  const advanceAmountMinor = remainingPayment;

  const allChecked =
    unpaidCharges.length > 0 &&
    unpaidCharges.every((c) => checkedCharges[c.chargeId]);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    unpaidCharges.forEach((c) => {
      next[c.chargeId] = !allChecked;
    });
    setCheckedCharges(next);
  };

  const selectedStudentObj = student;
  const displayInputVal = isFocused
    ? searchQuery
    : selectedStudentObj
      ? `${selectedStudentObj.studentNumber} · ${selectedStudentObj.displayName}`
      : "";

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "অর্থায়ন" : "Finance"}</p>
        <h1>
          {bn ? "পেমেন্ট, চার্জ ও বকেয়া" : "Payments, charges, and dues"}
        </h1>
        <p>
          {bn
            ? "পেমেন্ট সংগ্রহ করুন, বকেয়া এবং মাসিক ফি সংক্রান্ত যাবতীয় তথ্য পরিচালনা করুন।"
            : "Collect payments, configure fees and plans, and run monthly billing cycles."}
        </p>
      </header>

      {/* Tabs list */}
      <div
        className="tab-list"
        role="tablist"
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
          marginBottom: "24px",
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === "collect"}
          onClick={() => {
            setActiveTab("collect");
            setFeedback(null);
          }}
          className="button"
          style={{
            minHeight: "42px",
            border: "0",
            borderBottom: "2px solid transparent",
            background: "transparent",
            color: activeTab === "collect" ? "var(--ink)" : "var(--ink-mute)",
            borderBottomColor:
              activeTab === "collect" ? "var(--brand-deep)" : "transparent",
            fontWeight: activeTab === "collect" ? 600 : 400,
            borderRadius: 0,
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <DollarSign size={16} />
          {bn ? "ফি সংগ্রহ ও সমন্বয়" : "Collect & Adjust"}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "config"}
          onClick={() => {
            setActiveTab("config");
            setFeedback(null);
          }}
          className="button"
          style={{
            minHeight: "42px",
            border: "0",
            borderBottom: "2px solid transparent",
            background: "transparent",
            color: activeTab === "config" ? "var(--ink)" : "var(--ink-mute)",
            borderBottomColor:
              activeTab === "config" ? "var(--brand-deep)" : "transparent",
            fontWeight: activeTab === "config" ? 600 : 400,
            borderRadius: 0,
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Settings size={16} />
          {bn ? "পরিকল্পনা ও বিলিং রান" : "Plans & Billing Run"}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "reminders"}
          onClick={() => {
            setActiveTab("reminders");
            setFeedback(null);
          }}
          className="button"
          style={{
            minHeight: "42px",
            border: "0",
            borderBottom: "2px solid transparent",
            background: "transparent",
            color: activeTab === "reminders" ? "var(--ink)" : "var(--ink-mute)",
            borderBottomColor:
              activeTab === "reminders" ? "var(--brand-deep)" : "transparent",
            fontWeight: activeTab === "reminders" ? 600 : 400,
            borderRadius: 0,
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Bell size={16} />
          {bn ? "বকেয়া তাগিদ (SMS)" : "Due Reminders"}
        </button>
      </div>

      {/* Tab 1: Collect & Adjust */}
      {activeTab === "collect" && (
        <>
          {/* Search student container */}
          <div style={{ marginBottom: "24px", maxWidth: "480px" }}>
            <label
              className="standalone-field"
              style={{ position: "relative", display: "grid", gap: "6px" }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--ink-secondary)",
                }}
              >
                {bn
                  ? "শিক্ষার্থী অনুসন্ধান ও নির্বাচন"
                  : "Search & Select Student"}
              </span>
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Search
                    size={18}
                    style={{
                      position: "absolute",
                      left: "12px",
                      color: "var(--ink-mute)",
                    }}
                  />
                  <input
                    type="text"
                    value={displayInputVal}
                    placeholder={
                      bn
                        ? "নাম, মোবাইল বা আইডি দিয়ে খুঁজুন..."
                        : "Search by name, phone or ID..."
                    }
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                      setFeedback(null);
                    }}
                    onFocus={() => {
                      setIsFocused(true);
                      setShowDropdown(true);
                      setSearchQuery("");
                    }}
                    style={{
                      width: "100%",
                      height: "44px",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "6px",
                      padding: "9px 12px 9px 40px",
                      background: "var(--canvas)",
                      color: "var(--ink)",
                      fontSize: "14px",
                      outline: isFocused ? "2px solid var(--focus)" : "none",
                    }}
                  />
                  {studentId && !isFocused && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentId("");
                        setSearchQuery("");
                        setFeedback(null);
                      }}
                      style={{
                        position: "absolute",
                        right: "12px",
                        background: "none",
                        border: "none",
                        color: "var(--ink-mute)",
                        cursor: "pointer",
                        padding: "2px",
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {showDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      maxHeight: "300px",
                      overflowY: "auto",
                      background: "var(--canvas)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "6px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      marginTop: "4px",
                    }}
                  >
                    {displayStudents.length === 0 ? (
                      <div
                        style={{
                          padding: "12px",
                          color: "var(--ink-mute)",
                          fontSize: "13px",
                          textAlign: "center",
                        }}
                      >
                        {bn
                          ? "কোনো শিক্ষার্থী পাওয়া যায়নি"
                          : "No students found"}
                      </div>
                    ) : (
                      displayStudents.map((s, idx) => {
                        const isSelected = s.studentId === studentId;
                        return (
                          <div
                            key={s.studentId}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onClick={() => {
                              setStudentId(s.studentId);
                              setShowDropdown(false);
                              setIsFocused(false);
                              setFeedback(null);
                              setSearchQuery("");
                            }}
                            style={{
                              padding: "10px 12px",
                              cursor: "pointer",
                              borderBottom: "1px solid var(--border-muted)",
                              backgroundColor: isSelected
                                ? "var(--brand-muted)"
                                : hoveredIndex === idx
                                  ? "var(--canvas-subtle)"
                                  : "var(--canvas)",
                              color: isSelected
                                ? "var(--ink)"
                                : "var(--ink-secondary)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                              textAlign: "left",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  color: "var(--ink)",
                                }}
                              >
                                {s.displayName}
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontFamily: "var(--font-mono)",
                                  color: "var(--ink-mute)",
                                }}
                              >
                                {s.studentNumber}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "11px",
                                color: "var(--ink-mute)",
                              }}
                            >
                              <span>
                                {"phone" in s && s.phone
                                  ? s.phone
                                  : s.guardianPhone}
                              </span>
                              {s.status && (
                                <span
                                  style={{
                                    textTransform: "capitalize",
                                    fontWeight: 500,
                                    color:
                                      s.status === "active"
                                        ? "var(--success)"
                                        : "var(--ink-mute)",
                                  }}
                                >
                                  {s.status}
                                </span>
                              )}
                            </div>
                            {"coursesAndBatches" in s &&
                              s.coursesAndBatches &&
                              s.coursesAndBatches.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--ink-mute)",
                                    borderTop: "1px dashed var(--border-muted)",
                                    paddingTop: "2px",
                                    marginTop: "2px",
                                  }}
                                >
                                  {s.coursesAndBatches.map(
                                    (
                                      cb: {
                                        courseName: string;
                                        batchName: string;
                                      },
                                      i: number,
                                    ) => (
                                      <span
                                        key={i}
                                        style={{ marginRight: "8px" }}
                                      >
                                        {cb.courseName} ({cb.batchName})
                                      </span>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Feedback messages */}
          {feedback && (
            <div
              className={`form-message ${feedback.ok ? "success" : "error"}`}
              style={{
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: feedback.ok ? "var(--success)" : "var(--danger)",
                backgroundColor: feedback.ok ? "#f0fdf4" : "#fef2f2",
                color: feedback.ok ? "#15803d" : "#b91c1c",
                marginBottom: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: 600,
                }}
              >
                {feedback.ok ? (
                  <Check size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}
                <span>{feedback.text}</span>
              </div>
              {feedback.ok && feedback.paymentId && (
                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <Link
                    href={`/${locale}/owner/receipt/${feedback.paymentId}`}
                    className="button button-primary"
                    style={{
                      minHeight: "36px",
                      padding: "6px 14px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Printer size={14} />
                    {bn ? "রশিদ মুদ্রণ করুন" : "Print Receipt"}
                  </Link>
                  {feedback.studentId && (
                    <Link
                      href={`/${locale}/owner/students?student=${feedback.studentId}`}
                      className="button button-secondary"
                      style={{
                        minHeight: "36px",
                        padding: "6px 14px",
                        fontSize: "13px",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <User size={14} />
                      {bn ? "প্রোফাইল দেখুন" : "View Profile"}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Student Financial Summary Card */}
          {studentId && summary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <article
                style={{
                  padding: "16px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--canvas)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "মোট চার্জ" : "Total Charged"}
                </p>
                <strong
                  style={{
                    display: "block",
                    fontSize: "22px",
                    fontFamily: "var(--font-mono)",
                    marginTop: "6px",
                    color: "var(--ink)",
                    fontWeight: 600,
                  }}
                >
                  {formatMoney(summary.totalChargedMinor)}
                </strong>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    display: "block",
                    marginTop: "2px",
                  }}
                >
                  {bn
                    ? `ছাড় সমন্বিত: ${formatMoney(summary.totalDiscountMinor)}`
                    : `Discounts: ${formatMoney(summary.totalDiscountMinor)}`}
                </span>
              </article>
              <article
                style={{
                  padding: "16px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--canvas)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "মোট পরিশোধ" : "Total Paid"}
                </p>
                <strong
                  style={{
                    display: "block",
                    fontSize: "22px",
                    fontFamily: "var(--font-mono)",
                    marginTop: "6px",
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  {formatMoney(summary.totalPaidMinor)}
                </strong>
                {summary.lastPaymentAt && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--ink-mute)",
                      display: "block",
                      marginTop: "2px",
                    }}
                  >
                    {bn
                      ? `শেষ পেমেন্ট: ${new Date(summary.lastPaymentAt).toLocaleDateString("bn-BD")}`
                      : `Last: ${new Date(summary.lastPaymentAt).toLocaleDateString("en-GB")}`}
                  </span>
                )}
              </article>
              <article
                style={{
                  padding: "16px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--canvas)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "বকেয়া" : "Outstanding"}
                </p>
                <strong
                  style={{
                    display: "block",
                    fontSize: "22px",
                    fontFamily: "var(--font-mono)",
                    marginTop: "6px",
                    color:
                      summary.overdueMinor > 0 ? "var(--danger)" : "var(--ink)",
                    fontWeight: 600,
                  }}
                >
                  {formatMoney(summary.outstandingMinor)}
                </strong>
                {summary.overdueMinor > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--danger)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginTop: "2px",
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={12} />
                    {bn
                      ? `মেয়াদোত্তীর্ণ বকেয়া: ${formatMoney(summary.overdueMinor)}`
                      : `Overdue: ${formatMoney(summary.overdueMinor)}`}
                  </span>
                )}
              </article>
              <article
                style={{
                  padding: "16px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--canvas)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "অগ্রিম ক্রেডিট" : "Advance Credit"}
                </p>
                <strong
                  style={{
                    display: "block",
                    fontSize: "22px",
                    fontFamily: "var(--font-mono)",
                    marginTop: "6px",
                    color: "var(--info)",
                    fontWeight: 600,
                  }}
                >
                  {formatMoney(summary.advanceCreditMinor)}
                </strong>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    display: "block",
                    marginTop: "2px",
                  }}
                >
                  {bn
                    ? "ভবিষ্যৎ চার্জে সমন্বিত হবে"
                    : "Applied to future charges"}
                </span>
              </article>
            </div>
          )}

          {studentId && (
            <div
              className="editor-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "24px",
                alignItems: "start",
              }}
            >
              {/* Payment Collection Section */}
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "20px",
                  background: "var(--canvas)",
                }}
              >
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "10px",
                  }}
                >
                  <DollarSign
                    size={20}
                    style={{ color: "var(--brand-deep)" }}
                  />
                  {bn ? "পেমেন্ট সংগ্রহ করুন" : "Collect Student Payment"}
                </h2>

                <form
                  className="operation-form"
                  style={{
                    display: "grid",
                    gap: "16px",
                    gridTemplateColumns: "1fr",
                  }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (amountMinor <= 0) {
                      alert(
                        bn
                          ? "পরিমাণ ০ এর চেয়ে বেশি হতে হবে।"
                          : "Amount must be greater than zero.",
                      );
                      return;
                    }

                    setBusy(true);
                    setFeedback(null);

                    collect({
                      studentId: studentId as Id<"students">,
                      amountMinor,
                      allocations: computedAllocations.map((a) => ({
                        chargeId: a.chargeId,
                        amountMinor: a.amountMinor,
                      })),
                      method: paymentMethod,
                      externalReference: paymentRef || undefined,
                      paidAt: new Date(paidAt).getTime(),
                      note: paymentNote || undefined,
                    })
                      .then((result) => {
                        setFeedback({
                          ok: true,
                          text: `${bn ? "পেমেন্ট পোস্ট হয়েছে। রশিদ" : "Payment posted. Receipt"}: ${result.receiptNumber}`,
                          paymentId: result.paymentId,
                          studentId: studentId,
                        });
                        setPaymentAmount("");
                        setPaymentRef("");
                        setPaymentNote("");
                      })
                      .catch((cause) => {
                        setFeedback({
                          ok: false,
                          text:
                            cause instanceof Error
                              ? cause.message
                              : "Payment failed",
                        });
                      })
                      .finally(() => {
                        setBusy(false);
                      });
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontWeight: 500,
                      }}
                    >
                      {bn ? "পেমেন্ট পরিমাণ (৳)" : "Payment Amount (BDT)"}
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        style={{
                          height: "44px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontSize: "14px",
                          background: "var(--canvas)",
                        }}
                      />
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontWeight: 500,
                      }}
                    >
                      {bn ? "পেমেন্ট পদ্ধতি" : "Payment Method"}
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value as
                              | "cash"
                              | "bkash"
                              | "nagad"
                              | "bank_transfer"
                              | "cheque"
                              | "other",
                          )
                        }
                        style={{
                          height: "44px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontSize: "14px",
                          background: "var(--canvas)",
                        }}
                      >
                        <option value="cash">Cash</option>
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other</option>
                      </select>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontWeight: 500,
                      }}
                    >
                      {bn ? "পেমেন্ট তারিখ" : "Payment Date"}
                      <input
                        type="date"
                        required
                        value={paidAt}
                        onChange={(e) => setPaidAt(e.target.value)}
                        style={{
                          height: "44px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontSize: "14px",
                          background: "var(--canvas)",
                        }}
                      />
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontWeight: 500,
                      }}
                    >
                      {bn
                        ? "ট্রানজেকশন আইডি / রেফারেন্স"
                        : "Transaction ID / Reference"}
                      <input
                        value={paymentRef}
                        placeholder={bn ? "ঐচ্ছিক" : "Optional"}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        style={{
                          height: "44px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontSize: "14px",
                          background: "var(--canvas)",
                        }}
                      />
                    </label>
                  </div>

                  {/* Outstanding Charges Checkbox Table */}
                  <div style={{ marginTop: "8px" }}>
                    <h3
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--ink-secondary)",
                        marginBottom: "8px",
                      }}
                    >
                      {bn
                        ? "বকেয়া চার্জ নির্বাচন করুন"
                        : "Select Dues to Allocate"}
                    </h3>

                    {unpaidCharges.length === 0 ? (
                      <p
                        style={{
                          padding: "16px",
                          border: "1px dashed var(--border)",
                          borderRadius: "6px",
                          background: "var(--canvas-soft)",
                          color: "var(--ink-mute)",
                          margin: 0,
                        }}
                      >
                        {bn
                          ? "কোনো বকেয়া চার্জ নেই। সংগৃহীত পেমেন্ট সম্পূর্ণ অগ্রিম হিসেবে জমা হবে।"
                          : "No unpaid charges found. Payment will be saved entirely as advance credit."}
                      </p>
                    ) : (
                      <div className="table-wrap">
                        <table style={{ width: "100%", fontSize: "13px" }}>
                          <thead>
                            <tr>
                              <th
                                style={{
                                  width: "48px",
                                  textAlign: "center",
                                  padding: "10px",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onChange={toggleAll}
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    cursor: "pointer",
                                  }}
                                />
                              </th>
                              <th style={{ padding: "10px" }}>
                                {bn
                                  ? "চার্জ নম্বর ও বিবরণ"
                                  : "Charge & Description"}
                              </th>
                              <th style={{ padding: "10px" }}>
                                {bn ? "নির্ধারিত তারিখ" : "Due Date"}
                              </th>
                              <th
                                style={{ padding: "10px", textAlign: "right" }}
                              >
                                {bn ? "চার্জ পরিমাণ" : "Amount"}
                              </th>
                              <th
                                style={{ padding: "10px", textAlign: "right" }}
                              >
                                {bn ? "পরিশোধিত" : "Paid"}
                              </th>
                              <th
                                style={{ padding: "10px", textAlign: "right" }}
                              >
                                {bn ? "বকেয়া ব্যালেন্স" : "Due Balance"}
                              </th>
                              <th
                                style={{
                                  padding: "10px",
                                  textAlign: "right",
                                  color: "var(--brand-deep)",
                                  fontWeight: 600,
                                }}
                              >
                                {bn ? "বরাদ্দ" : "Allocated"}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {unpaidCharges.map((charge) => {
                              const isChecked =
                                !!checkedCharges[charge.chargeId];
                              const balanceMinor =
                                charge.netAmountMinor - charge.paidAmountMinor;
                              const allocationObj = computedAllocations.find(
                                (a) => a.chargeId === charge.chargeId,
                              );
                              const allocatedMinor = allocationObj
                                ? allocationObj.amountMinor
                                : 0;

                              return (
                                <tr
                                  key={charge.chargeId}
                                  style={{
                                    background: isChecked
                                      ? "rgba(62, 207, 142, 0.04)"
                                      : "none",
                                  }}
                                >
                                  <td
                                    style={{
                                      textAlign: "center",
                                      verticalAlign: "middle",
                                      padding: "10px",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setCheckedCharges((prev) => ({
                                          ...prev,
                                          [charge.chargeId]:
                                            !prev[charge.chargeId],
                                        }));
                                      }}
                                      style={{
                                        width: "18px",
                                        height: "18px",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: "10px" }}>
                                    <div style={{ fontWeight: 600 }}>
                                      {charge.description}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "var(--ink-mute)",
                                        fontFamily: "var(--font-mono)",
                                      }}
                                    >
                                      {charge.chargeNumber}
                                    </div>
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color:
                                          charge.dueDate <
                                          new Date().toLocaleDateString("en-CA")
                                            ? "var(--danger)"
                                            : "var(--ink)",
                                        fontWeight:
                                          charge.dueDate <
                                          new Date().toLocaleDateString("en-CA")
                                            ? 600
                                            : 400,
                                      }}
                                    >
                                      {charge.dueDate}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      textAlign: "right",
                                      verticalAlign: "middle",
                                      fontFamily: "var(--font-mono)",
                                    }}
                                  >
                                    {formatMoney(charge.netAmountMinor)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      textAlign: "right",
                                      verticalAlign: "middle",
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--success)",
                                    }}
                                  >
                                    {formatMoney(charge.paidAmountMinor)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      textAlign: "right",
                                      verticalAlign: "middle",
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {formatMoney(balanceMinor)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px",
                                      textAlign: "right",
                                      verticalAlign: "middle",
                                      fontFamily: "var(--font-mono)",
                                      fontWeight: 600,
                                      color:
                                        allocatedMinor > 0
                                          ? "var(--success)"
                                          : "var(--ink-mute)",
                                    }}
                                  >
                                    {formatMoney(allocatedMinor)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Allocation Running Summary Card */}
                  {amountVal > 0 && (
                    <div
                      style={{
                        padding: "14px",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        backgroundColor: "var(--canvas-soft)",
                        marginTop: "8px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          margin: "0 0 8px",
                        }}
                      >
                        {bn
                          ? "পেমেন্ট বন্টন সারসংক্ষেপ:"
                          : "Payment Allocation Summary:"}
                      </h4>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "16px",
                          fontSize: "12.5px",
                          display: "grid",
                          gap: "4px",
                        }}
                      >
                        {computedAllocations.map((alloc) => (
                          <li key={alloc.chargeId}>
                            {bn
                              ? `${alloc.description} (${alloc.chargeNumber}) চার্জে বরাদ্দ: `
                              : `Allocated to ${alloc.description} (${alloc.chargeNumber}): `}
                            <strong
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--success)",
                              }}
                            >
                              {formatMoney(alloc.amountMinor)}
                            </strong>
                          </li>
                        ))}
                        {advanceAmountMinor > 0 && (
                          <li>
                            {bn
                              ? "অগ্রিম ক্রেডিট হিসেবে জমা থাকবে: "
                              : "Credited as advance account balance: "}
                            <strong
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--info)",
                              }}
                            >
                              {formatMoney(advanceAmountMinor)}
                            </strong>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      fontWeight: 500,
                    }}
                  >
                    {bn ? "নোট" : "Note"}
                    <textarea
                      rows={3}
                      value={paymentNote}
                      placeholder={
                        bn
                          ? "পেমেন্ট সংক্রান্ত কোনো বিবরণ বা বিশেষ তথ্য..."
                          : "Any additional notes regarding this payment..."
                      }
                      onChange={(e) => setPaymentNote(e.target.value)}
                      style={{
                        border: "1px solid var(--border-strong)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "14px",
                        background: "var(--canvas)",
                        resize: "vertical",
                      }}
                    />
                  </label>

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={busy || amountVal <= 0}
                    style={{ height: "44px", marginTop: "8px" }}
                  >
                    {busy
                      ? bn
                        ? "প্রক্রিয়াধীন..."
                        : "Posting..."
                      : bn
                        ? "পেমেন্ট পোস্ট করুন"
                        : "Post Payment"}
                  </button>
                </form>
              </div>

              {/* Adjustments: Create Custom Charge & Void Payments Side by Side */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "24px",
                }}
              >
                {/* Custom Charge Form */}
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "20px",
                    background: "var(--canvas)",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: "10px",
                    }}
                  >
                    <PlusCircle
                      size={20}
                      style={{ color: "var(--brand-deep)" }}
                    />
                    {bn ? "কাস্টম চার্জ যোগ করুন" : "Create Custom Charge"}
                  </h2>
                  <form
                    style={{ display: "grid", gap: "12px" }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void execute(() =>
                        customCharge({
                          studentId: studentId as Id<"students">,
                          type: data.get("type") as
                            | "admission"
                            | "monthly"
                            | "course"
                            | "exam"
                            | "material"
                            | "custom",
                          descriptionBn: String(data.get("descriptionBn")),
                          descriptionEn: String(data.get("descriptionEn")),
                          amountMinor: toMinor(String(data.get("amount"))),
                          dueDate: String(data.get("dueDate")),
                          generationKey: crypto.randomUUID(),
                        }),
                      );
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontWeight: 500,
                      }}
                    >
                      {bn ? "চার্জের ধরন" : "Charge Type"}
                      <select
                        name="type"
                        style={{
                          height: "40px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "14px",
                          background: "var(--canvas)",
                        }}
                      >
                        <option value="custom">Custom</option>
                        <option value="admission">Admission</option>
                        <option value="monthly">Monthly</option>
                        <option value="course">Course</option>
                        <option value="exam">Exam</option>
                        <option value="material">Material</option>
                      </select>
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          fontWeight: 500,
                        }}
                      >
                        বাংলা বিবরণ
                        <input
                          name="descriptionBn"
                          required
                          style={{
                            height: "40px",
                            border: "1px solid var(--border-strong)",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "14px",
                            background: "var(--canvas)",
                          }}
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          fontWeight: 500,
                        }}
                      >
                        English Description
                        <input
                          name="descriptionEn"
                          required
                          style={{
                            height: "40px",
                            border: "1px solid var(--border-strong)",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "14px",
                            background: "var(--canvas)",
                          }}
                        />
                      </label>
                    </div>
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontWeight: 500,
                      }}
                    >
                      {bn ? "চার্জ পরিমাণ (৳)" : "Amount (BDT)"}
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        style={{
                          height: "40px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "14px",
                          background: "var(--canvas)",
                        }}
                      />
                    </label>
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontWeight: 500,
                      }}
                    >
                      {bn ? "নির্ধারিত তারিখ" : "Due Date"}
                      <input
                        name="dueDate"
                        type="date"
                        required
                        style={{
                          height: "40px",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "14px",
                          background: "var(--canvas)",
                        }}
                      />
                    </label>
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      style={{ height: "40px", marginTop: "8px" }}
                    >
                      {bn ? "চার্জ তৈরি করুন" : "Create Charge"}
                    </button>
                  </form>
                </div>

                {/* Void Payment Actions Log */}
                {payments?.page.length ? (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "20px",
                      background: "var(--canvas)",
                    }}
                  >
                    <h2
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        marginBottom: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        borderBottom: "1px solid var(--border)",
                        paddingBottom: "10px",
                      }}
                    >
                      <CreditCard
                        size={20}
                        style={{ color: "var(--brand-deep)" }}
                      />
                      {bn ? "সাম্প্রতিক পেমেন্ট লগ" : "Recent Payments Log"}
                    </h2>

                    <div
                      className="table-wrap"
                      style={{ maxHeight: "280px", overflowY: "auto" }}
                    >
                      <table style={{ fontSize: "12.5px", width: "100%" }}>
                        <thead>
                          <tr>
                            <th>{bn ? "রশিদ" : "Receipt"}</th>
                            <th style={{ textAlign: "right" }}>
                              {bn ? "পরিমাণ" : "Amount"}
                            </th>
                            <th>{bn ? "অবস্থা" : "Status"}</th>
                            <th>{bn ? "অ্যাকশন" : "Action"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.page.map((payment) => (
                            <tr key={payment.paymentId}>
                              <td>
                                <Link
                                  href={`/${locale}/owner/receipt/${payment.paymentId}`}
                                  style={{
                                    fontWeight: 600,
                                    color: "var(--brand-deep)",
                                    textDecoration: "underline",
                                  }}
                                >
                                  {payment.receiptNumber}
                                </Link>
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "10px",
                                    color: "var(--ink-mute)",
                                  }}
                                >
                                  {new Date(payment.paidAt).toLocaleDateString(
                                    locale === "bn" ? "bn-BD" : "en-GB",
                                  )}
                                </span>
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                {formatMoney(payment.amountMinor)}
                                {payment.advanceAmountMinor > 0 && (
                                  <span
                                    style={{
                                      display: "block",
                                      fontSize: "10px",
                                      color: "var(--info)",
                                    }}
                                  >
                                    {bn
                                      ? `(অগ্রিম: ${formatMoney(payment.advanceAmountMinor)})`
                                      : `(Adv: ${formatMoney(payment.advanceAmountMinor)})`}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: 500,
                                    backgroundColor:
                                      payment.status === "posted"
                                        ? "var(--brand-muted)"
                                        : "var(--canvas-subtle)",
                                    color:
                                      payment.status === "posted"
                                        ? "var(--brand-deep)"
                                        : "var(--ink-mute)",
                                    textDecoration:
                                      payment.status === "voided"
                                        ? "line-through"
                                        : "none",
                                  }}
                                >
                                  {payment.status === "posted"
                                    ? bn
                                      ? "সংগৃহীত"
                                      : "Posted"
                                    : bn
                                      ? "বাতিল"
                                      : "Voided"}
                                </span>
                              </td>
                              <td>
                                {payment.status === "posted" && (
                                  <button
                                    className="button button-ghost"
                                    disabled={busy}
                                    aria-expanded={
                                      voidTarget === payment.paymentId
                                    }
                                    onClick={() =>
                                      setVoidTarget(payment.paymentId)
                                    }
                                    style={{
                                      minHeight: "28px",
                                      padding: "2px 8px",
                                      fontSize: "11px",
                                      border: "1px solid var(--danger)",
                                      color: "var(--danger)",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    {bn ? "বাতিল" : "Void"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {voidTarget && (
                      <form
                        className="operation-form"
                        role="alertdialog"
                        aria-labelledby="void-payment-title"
                        style={{
                          marginTop: "16px",
                          padding: "16px",
                          border: "1px solid var(--danger)",
                          borderRadius: "8px",
                          backgroundColor: "#fef2f2",
                          display: "grid",
                          gap: "12px",
                        }}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void execute(() =>
                            voidPayment({
                              paymentId: voidTarget,
                              reason: voidReason,
                            }),
                          ).then((ok) => {
                            if (ok) {
                              setVoidTarget("");
                              setVoidReason("");
                            }
                          });
                        }}
                      >
                        <h3
                          id="void-payment-title"
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "var(--danger)",
                            margin: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <AlertTriangle size={16} />
                          {bn
                            ? "পেমেন্ট বাতিল নিশ্চিতকরণ"
                            : "Confirm Void Payment"}
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "var(--ink-secondary)",
                          }}
                        >
                          {bn
                            ? "এই পেমেন্টটি বাতিল করা হলে সংশ্লিষ্ট চার্জসমূহ পুনরায় বকেয়া হিসেবে চিহ্নিত হবে। পুরোনো রেকর্ড মুছবে না।"
                            : "Voiding this payment will mark allocated charges as due again. The record will remain as voided."}
                        </p>
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            fontSize: "12.5px",
                            fontWeight: 500,
                          }}
                        >
                          {bn ? "বাতিল করার কারণ" : "Void Reason"}
                          <input
                            name="reason"
                            required
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            placeholder={
                              bn
                                ? "যেমন: ভুল তথ্য এন্ট্রি"
                                : "e.g., Typo or wrong student selected"
                            }
                            style={{
                              height: "36px",
                              border: "1px solid var(--border-strong)",
                              borderRadius: "4px",
                              padding: "6px 10px",
                              background: "var(--canvas)",
                            }}
                          />
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            className="button button-secondary"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setVoidTarget("");
                              setVoidReason("");
                            }}
                            style={{
                              minHeight: "32px",
                              padding: "4px 10px",
                              fontSize: "12px",
                            }}
                          >
                            {bn ? "ফিরে যান" : "Cancel"}
                          </button>
                          <button
                            className="button button-danger"
                            disabled={busy}
                            style={{
                              minHeight: "32px",
                              padding: "4px 10px",
                              fontSize: "12px",
                            }}
                          >
                            {bn ? "বাতিল নিশ্চিত করুন" : "Void Payment"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab 2: Billing & Plans Configuration */}
      {activeTab === "config" && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "20px",
            background: "var(--canvas)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "10px",
            }}
          >
            <Settings size={20} style={{ color: "var(--brand-deep)" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
              {bn
                ? "ফি পরিকল্পনা, ছাড় ও বিলিং সেটআপ"
                : "Billing, Fees & Discount Management"}
            </h2>
          </div>
          <BillingSetup locale={locale} />
        </div>
      )}

      {/* Tab 3: Due Reminders */}
      {activeTab === "reminders" && (
        <section
          className="section"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "20px",
            background: "var(--canvas)",
          }}
        >
          <div
            className="section-heading"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={20} style={{ color: "var(--brand-deep)" }} />
              <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
                {bn
                  ? "বকেয়া তাগিদ তালিকা ও SMS"
                  : "Due Reminders & Notifications"}
              </h2>
            </div>
            {!confirmingReminders && (
              <button
                className="button button-primary"
                disabled={busy || due.length === 0}
                aria-expanded={confirmingReminders}
                onClick={() => setConfirmingReminders(true)}
              >
                {bn ? "সবাইকে তাগিদ পাঠান (SMS)" : "Queue Due Reminders (SMS)"}
              </button>
            )}
          </div>

          {confirmingReminders && (
            <section
              className="operation-form"
              role="alertdialog"
              aria-labelledby="due-reminder-title"
              style={{
                padding: "20px",
                border: "1px solid var(--warning)",
                backgroundColor: "var(--warning-muted)",
                borderRadius: "8px",
                marginBottom: "20px",
                display: "grid",
                gap: "12px",
              }}
            >
              <h3
                id="due-reminder-title"
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--warning-deep)",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <AlertTriangle size={18} />
                {bn
                  ? "বকেয়া তাগিদ রিমাইন্ডার নিশ্চিত করুন"
                  : "Confirm Due Reminders"}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--ink-secondary)",
                }}
              >
                {bn
                  ? `মোট ${due.length} জন বকেয়া শিক্ষার্থীর অভিভাবকের মোবাইলে বকেয়া রিমাইন্ডার SMS কিউ হবে। ব্যর্থ ডেলিভারি আর্থিক রেকর্ডে প্রভাব ফেলবে না।`
                  : `This will queue SMS reminders for ${due.length} guardians of students with overdue balances. Failed SMS delivery will not roll back financial records.`}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmingReminders(false)}
                >
                  {bn ? "ফিরে যান" : "Cancel"}
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={busy || due.length === 0}
                  onClick={() => {
                    void execute(() =>
                      remind({ studentIds: due.map((row) => row.studentId) }),
                    ).then((ok) => {
                      if (ok) setConfirmingReminders(false);
                    });
                  }}
                >
                  {bn
                    ? `${due.length}টি তাগিদ পাঠান`
                    : `Queue ${due.length} Reminders`}
                </button>
              </div>
            </section>
          )}

          {due.length ? (
            <div className="table-wrap">
              <table style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>{bn ? "শিক্ষার্থী" : "Student"}</th>
                    <th style={{ textAlign: "right" }}>
                      {bn ? "মেয়াদোত্তীর্ণ বকেয়া" : "Overdue Dues"}
                    </th>
                    <th>{bn ? "অভিভাবকের মোবাইল" : "Guardian Phone"}</th>
                    <th>{bn ? "অ্যাকশন" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {due.map((row) => (
                    <tr key={row.studentId}>
                      <td style={{ fontWeight: 600 }}>{row.displayName}</td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          color: "var(--danger)",
                          fontWeight: 600,
                        }}
                      >
                        {formatMoney(row.overdueMinor)}
                      </td>
                      <td>{row.guardianPhone}</td>
                      <td>
                        <button
                          className="button button-secondary"
                          disabled={busy}
                          onClick={() => {
                            setStudentId(row.studentId);
                            setActiveTab("collect");
                            setFeedback(null);
                          }}
                          style={{
                            minHeight: "32px",
                            padding: "4px 10px",
                            fontSize: "12px",
                            borderRadius: "4px",
                          }}
                        >
                          {bn ? "সংগ্রহ ও সমন্বয়" : "Collect & Adjust"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p
              className="empty-panel"
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--ink-mute)",
                fontSize: "14px",
              }}
            >
              {bn
                ? "বর্তমানে কোনো শিক্ষার্থীর বকেয়া নেই।"
                : "No active students have overdue balances."}
            </p>
          )}
        </section>
      )}
    </>
  );
}
