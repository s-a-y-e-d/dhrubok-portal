"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";
import { OwnerSettingsEditor as SettingsEditor } from "./OwnerEditors";
import { CoachingSettingsInitializer, OwnerAccountAdministration } from "./OwnerAdministration";
import { SmsTemplateEditor } from "./SmsTemplateEditor";

type SettingsTab = "operations" | "sms" | "access";

export function OwnerSettingsEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const settings = useQuery(api.settings.getOwner, {});
  const [tab, setTab] = useState<SettingsTab>("operations");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handleUrlSync = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      if (urlTab === "operations" || urlTab === "sms" || urlTab === "access") {
        setTab(urlTab);
      } else {
        setTab("operations");
      }
    };
    handleUrlSync();
    window.addEventListener("popstate", handleUrlSync);
    return () => window.removeEventListener("popstate", handleUrlSync);
  }, []);

  const handleTabChange = (newTab: SettingsTab, useReplace = false) => {
    setTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    if (useReplace) {
      window.history.replaceState(null, "", url.pathname + url.search);
    } else {
      window.history.pushState(null, "", url.pathname + url.search);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const tabsList: SettingsTab[] = ["operations", "sms", "access"];
    let newIndex = index;

    if (e.key === "ArrowRight") {
      newIndex = (index + 1) % tabsList.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (index - 1 + tabsList.length) % tabsList.length;
    } else if (e.key === "Home") {
      newIndex = 0;
    } else if (e.key === "End") {
      newIndex = tabsList.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    tabRefs.current[newIndex]?.focus();
    handleTabChange(tabsList[newIndex], true); // Keyboard arrow sync uses replaceState
  };

  if (settings === undefined) return <PortalPageState state="loading" locale={locale} />;

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "সিস্টেম অ্যাডমিন" : "System Administration"}</p>
        <h1>{bn ? "কোচিং সেটিংস ও অ্যাক্সেস" : "Coaching Settings & Access"}</h1>
        <p>
          {bn
            ? "কোচিংয়ের সাধারণ সেটিংস, বিভিন্ন সুবিধা অন/অফ এবং পোর্টালের অ্যাকাউন্ট অ্যাক্সেস নিয়ন্ত্রণ পরিচালনা করুন।"
            : "Configure coaching operation parameters, toggles, receipt footers, and manage portal account access permissions."}
        </p>
      </header>

      <div className="tab-list" role="tablist" aria-label={bn ? "সেটিংস ট্যাব" : "Settings tabs"}>
        <button
          id="tab-operations"
          ref={(el) => {
            tabRefs.current[0] = el;
          }}
          type="button"
          role="tab"
          aria-selected={tab === "operations"}
          aria-controls="panel-operations"
          tabIndex={tab === "operations" ? 0 : -1}
          onClick={() => handleTabChange("operations")}
          onKeyDown={(e) => handleKeyDown(e, 0)}
        >
          {bn ? "অপারেশন সেটিংস" : "Operations Settings"}
        </button>
        <button
          id="tab-sms"
          ref={(el) => {
            tabRefs.current[1] = el;
          }}
          type="button"
          role="tab"
          aria-selected={tab === "sms"}
          aria-controls="panel-sms"
          tabIndex={tab === "sms" ? 0 : -1}
          onClick={() => handleTabChange("sms")}
          onKeyDown={(e) => handleKeyDown(e, 1)}
        >
          {bn ? "SMS টেমপ্লেট" : "SMS Templates"}
        </button>
        <button
          id="tab-access"
          ref={(el) => {
            tabRefs.current[2] = el;
          }}
          type="button"
          role="tab"
          aria-selected={tab === "access"}
          aria-controls="panel-access"
          tabIndex={tab === "access" ? 0 : -1}
          onClick={() => handleTabChange("access")}
          onKeyDown={(e) => handleKeyDown(e, 2)}
        >
          {bn ? "অ্যাক্সেস নিয়ন্ত্রণ" : "Access Control"}
        </button>
      </div>

      <div style={{ marginTop: "20px" }}>
        {tab === "operations" && (
          <div
            id="panel-operations"
            role="tabpanel"
            aria-labelledby="tab-operations"
            tabIndex={0}
          >
            {settings === null ? (
              <CoachingSettingsInitializer locale={locale} />
            ) : (
              <SettingsEditor locale={locale} settings={settings} hideHeader={true} />
            )}
          </div>
        )}

        {tab === "access" && (
          <div
            id="panel-access"
            role="tabpanel"
            aria-labelledby="tab-access"
            tabIndex={0}
          >
            <OwnerAccountAdministration locale={locale} hideHeader={true} />
          </div>
        )}
        {tab === "sms" && settings !== null && (
          <div
            id="panel-sms"
            role="tabpanel"
            aria-labelledby="tab-sms"
            tabIndex={0}
          >
            <SmsTemplateEditor locale={locale} settings={settings} />
          </div>
        )}
        {tab === "sms" && settings === null && <CoachingSettingsInitializer locale={locale} />}
      </div>
    </>
  );
}
