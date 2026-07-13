"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, useEffect, type FormEvent } from "react";
import { Search } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import styles from "./portal.module.css";
import { useSearchParams } from "next/navigation";

const page = { numItems: 100, cursor: null } as const;

export function OwnerStudentsEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const paramStudentId = searchParams?.get("student") || "";

  const students = useQuery(api.students.owner.listStudents, { status: "active", paginationOpts: page });
  const requests = useQuery(api.students.owner.listChangeRequests, { status: "pending", paginationOpts: page });
  const [selectedId, setSelectedId] = useState<Id<"students"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selected = useQuery(api.students.owner.getStudent, selectedId ? { studentId: selectedId } : "skip");
  const update = useMutation(api.students.owner.updateStudent);
  const review = useMutation(api.students.owner.reviewChangeRequest);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!students) return;
    const matchingStudent = students.page.find((student) => student.studentId === paramStudentId);
    const timeoutId = setTimeout(() => setSelectedId(matchingStudent?.studentId ?? null), 0);
    return () => clearTimeout(timeoutId);
  }, [students, paramStudentId]);

  if (!students || !requests) return <PortalPageState state="loading" locale={locale} />;

  async function execute(work: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage(bn ? "পরিবর্তন সংরক্ষিত হয়েছে।" : "Changes saved.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const data = new FormData(event.currentTarget);
    void execute(() =>
      update({
        studentId: selectedId,
        rollNumber: String(data.get("rollNumber") || "") || null,
        displayName: String(data.get("displayName")),
        loginEmail: String(data.get("loginEmail")),
        phone: String(data.get("phone") || "") || null,
        schoolCollege: String(data.get("schoolCollege")),
        currentClass: String(data.get("currentClass")),
        address: String(data.get("address") || "") || null,
        guardianName: String(data.get("guardianName")),
        guardianPhone: String(data.get("guardianPhone")),
        guardianRelationship: String(data.get("guardianRelationship")),
        alternateGuardianPhone: String(data.get("alternateGuardianPhone") || "") || null,
        motherName: String(data.get("motherName")),
        motherPhone: String(data.get("motherPhone")),
        smsRecipient: data.get("smsRecipient") === "mother" ? "mother" : data.get("smsRecipient") === "both" ? "both" : "father",
        preferredSmsLocale: data.get("preferredSmsLocale") === "en" ? "en" : "bn",
        status: data.get("status") as "active" | "paused" | "completed" | "left" | "archived",
        internalNote: String(data.get("internalNote") || "") || null,
      })
    );
  }

  const filteredStudents = students.page.filter((student) => {
    const query = searchQuery.toLowerCase();
    return (
      student.displayName.toLowerCase().includes(query) ||
      student.studentNumber.toLowerCase().includes(query) ||
      student.guardianPhone.toLowerCase().includes(query) ||
      (student.loginEmail && student.loginEmail.toLowerCase().includes(query))
    );
  });

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "শিক্ষার্থী রেকর্ড" : "Student records"}</p>
        <h1>{bn ? "শিক্ষার্থী ও প্রোফাইল অনুরোধ" : "Students and profile requests"}</h1>
      </header>

      {message && <p className="form-message" role="status">{message}</p>}

      {requests.page.length > 0 && (
        <section className="section">
          <h2>{bn ? "অপেক্ষমাণ সংবেদনশীল পরিবর্তন" : "Pending sensitive changes"}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{bn ? "ক্ষেত্র" : "Field"}</th>
                  <th>{bn ? "পুরনো" : "Old"}</th>
                  <th>{bn ? "প্রস্তাবিত" : "Requested"}</th>
                  <th>{bn ? "কারণ" : "Reason"}</th>
                  <th>{bn ? "সিদ্ধান্ত" : "Decision"}</th>
                </tr>
              </thead>
              <tbody>
                {requests.page.map((request) => (
                  <tr key={request.requestId}>
                    <td>{request.fieldKey}</td>
                    <td>{request.oldValue}</td>
                    <td>{request.requestedValue}</td>
                    <td>{request.reason ?? "—"}</td>
                    <td>
                      <div className="form-actions">
                        <button
                          className="button button-primary"
                          disabled={busy}
                          onClick={() => void execute(() => review({ requestId: request.requestId, decision: "approved" }))}
                        >
                          {bn ? "অনুমোদন" : "Approve"}
                        </button>
                        <button
                          className="button button-danger"
                          disabled={busy}
                          onClick={() => void execute(() => review({ requestId: request.requestId, decision: "rejected" }))}
                        >
                          {bn ? "প্রত্যাখ্যান" : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="master-detail">
        <section>
          <h2>{bn ? "সক্রিয় শিক্ষার্থী" : "Active students"}</h2>

          <div className={styles.studentSearchContainer}>
            <Search className={styles.studentSearchIcon} aria-hidden="true" />
            <input
              type="text"
              className={styles.studentSearchInput}
              placeholder={bn ? "নাম, আইডি বা ফোন দিয়ে খুঁজুন..." : "Search by name, ID or phone..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={bn ? "শিক্ষার্থী খুঁজুন" : "Search students"}
            />
          </div>

          {filteredStudents.length ? (
            <div className={styles.studentCardList}>
              {filteredStudents.map((student) => (
                <button
                  key={student.studentId}
                  className={`${styles.studentListItem} ${selectedId === student.studentId ? styles.studentListItemActive : ""}`}
                  onClick={() => setSelectedId(student.studentId)}
                >
                  <div className={styles.studentListAvatar}>
                    {student.displayName ? student.displayName.charAt(0) : "S"}
                  </div>
                  <div className={styles.studentCardMeta}>
                    <span className={styles.studentCardName}>{student.displayName}</span>
                    <span className={styles.studentCardSub}>
                      {student.studentNumber} · {student.guardianPhone}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-panel">
              {searchQuery
                ? (bn ? "কোনো শিক্ষার্থী পাওয়া যায়নি।" : "No matching students found.")
                : (bn ? "সক্রিয় শিক্ষার্থী নেই।" : "No active students.")}
            </p>
          )}
        </section>

        <section>
          {selectedId && selected === undefined ? (
            <PortalPageState state="loading" locale={locale} />
          ) : selected ? (
            <form className={`${styles.premiumForm} operation-form`} key={selected.studentId} onSubmit={submit}>
              <div className={styles.premiumFormHeader}>
                <h2 className={styles.premiumFormHeaderTitle}>{selected.displayName}</h2>
                <span className={styles.premiumFormHeaderSubtitle}>{selected.studentNumber}</span>
              </div>

              <div className={styles.premiumFormBody}>
                {/* Academic & Personal Section */}
                <div className={styles.premiumFormSection}>
                  <h3 className={styles.premiumFormSectionTitle}>
                    {bn ? "একাডেমিক ও ব্যক্তিগত তথ্য" : "Personal & Academic Info"}
                  </h3>
                  <div className="form-grid">
                    <label>
                      {bn ? "রোল" : "Roll"}
                      <input name="rollNumber" defaultValue={selected.rollNumber ?? ""} />
                    </label>
                    <label>
                      {bn ? "অফিসিয়াল নাম" : "Official name"}
                      <input name="displayName" defaultValue={selected.displayName} required />
                    </label>
                    <label>
                      Google email
                      <input name="loginEmail" type="email" defaultValue={selected.loginEmail} required />
                    </label>
                    <label>
                      {bn ? "ফোন" : "Phone"}
                      <input name="phone" defaultValue={selected.phone ?? ""} />
                    </label>
                    <label>
                      {bn ? "স্কুল/কলেজ" : "School/college"}
                      <input name="schoolCollege" defaultValue={selected.schoolCollege} required />
                    </label>
                    <label>
                      {bn ? "শ্রেণি" : "Class"}
                      <input name="currentClass" defaultValue={selected.currentClass} required />
                    </label>
                  </div>
                </div>

                {/* Guardian Details */}
                <div className={styles.premiumFormSection}>
                  <h3 className={styles.premiumFormSectionTitle}>
                    {bn ? "বাবা ও মায়ের বিবরণ" : "Father and Mother Details"}
                  </h3>
                  <div className="form-grid">
                    <label>
                      {bn ? "বাবার নাম" : "Father's name"}
                      <input name="guardianName" defaultValue={selected.guardianName} required />
                    </label>
                    <label>
                      <input name="guardianRelationship" type="hidden" value="father" />
                    </label>
                    <label>
                      {bn ? "বাবার ফোন" : "Father's phone"}
                      <input name="guardianPhone" defaultValue={selected.guardianPhone} required />
                    </label>
                    <label>
                      {bn ? "মায়ের নাম" : "Mother's name"}
                      <input name="motherName" defaultValue={selected.motherName ?? ""} required />
                    </label>
                    <label>
                      {bn ? "মায়ের ফোন" : "Mother's phone"}
                      <input name="motherPhone" defaultValue={selected.motherPhone ?? ""} required />
                    </label>
                  </div>
                </div>

                {/* Portal settings */}
                <div className={styles.premiumFormSection}>
                  <h3 className={styles.premiumFormSectionTitle}>
                    {bn ? "পোর্টাল ও SMS সেটিংস" : "Portal Settings"}
                  </h3>
                  <div className="form-grid">
                    <label>
                      {bn ? "SMS প্রাপক" : "SMS recipient"}
                      <select name="smsRecipient" defaultValue={selected.smsRecipient}>
                        <option value="father">{bn ? "বাবা" : "Father"}</option>
                        <option value="mother">{bn ? "মা" : "Mother"}</option>
                        <option value="both">{bn ? "বাবা ও মা দুজনই" : "Both father and mother"}</option>
                      </select>
                    </label>
                    <label>
                      {bn ? "SMS ভাষা" : "SMS locale"}
                      <select name="preferredSmsLocale" defaultValue={selected.preferredSmsLocale}>
                        <option value="bn">বাংলা</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label>
                      {bn ? "অবস্থা" : "Status"}
                      <select name="status" defaultValue={selected.status}>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="completed">completed</option>
                        <option value="left">left</option>
                        <option value="archived">archived</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Additional Info */}
                <div className={styles.premiumFormSection}>
                  <h3 className={styles.premiumFormSectionTitle}>
                    {bn ? "অতিরিক্ত তথ্য" : "Additional Info"}
                  </h3>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <label>
                      {bn ? "ঠিকানা" : "Address"}
                      <textarea name="address" defaultValue={selected.address ?? ""} rows={3} style={{ width: '100%', resize: 'vertical' }} />
                    </label>
                    <label>
                      {bn ? "অভ্যন্তরীণ নোট" : "Internal note"}
                      <textarea name="internalNote" defaultValue={selected.internalNote ?? ""} rows={3} style={{ width: '100%', resize: 'vertical' }} />
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.premiumFormActions}>
                <button className="button button-primary" disabled={busy}>
                  {bn ? "সংরক্ষণ" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <p className="empty-panel">
              {bn ? "সম্পাদনার জন্য শিক্ষার্থী নির্বাচন করুন।" : "Select a student to edit."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
