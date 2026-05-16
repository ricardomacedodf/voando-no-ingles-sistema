import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CircleAlert,
  Crown,
  RotateCcw,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  REVIEW_PACE,
  getProgressSummary,
  loadReviewPreferences,
  normalizeVocabularyItem,
  saveReviewPreferences,
} from "../lib/learningEngine";
import {
  clearCachedVocabularyRows,
  markVocabularyCacheForRefresh,
} from "../lib/vocabularyCache";

const EMPTY_PROGRESS = Object.freeze(
  getProgressSummary([], { pace: REVIEW_PACE.EQUILIBRADO })
);

const REVIEW_PACE_OPTIONS = [
  { value: REVIEW_PACE.INTENSIVO, label: "Intensivo" },
  { value: REVIEW_PACE.EQUILIBRADO, label: "Equilibrado" },
  { value: REVIEW_PACE.LEVE, label: "Leve" },
];

const COLORS = {
  dominated: "#29AE67",
  nearMastery: "#2d8bff",
  reinforce: "#FA2137",
  fresh: "#9aa4b3",
};

const RECENT_NEW_WORDS_WINDOW_DAYS = 2;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const PROGRESS_PAGE_CSS = `
@media (min-width: 641px) {
  @supports selector(body:has(.vni-progress-page)) {
    html:has(.vni-progress-page),
    body:has(.vni-progress-page),
    #root:has(.vni-progress-page) {
      height: 100%;
      overflow-y: hidden;
      overscroll-behavior: none;
    }

    html:has(.vni-progress-page[data-scroll-unlocked="true"]),
    body:has(.vni-progress-page[data-scroll-unlocked="true"]),
    #root:has(.vni-progress-page[data-scroll-unlocked="true"]) {
      height: auto;
      min-height: 100%;
      overflow-y: auto;
      overscroll-behavior: auto;
    }
  }
}

@media (max-width: 640px) {
  @supports selector(body:has(.vni-progress-page)) {
    html:has(.vni-progress-page),
    body:has(.vni-progress-page),
    #root:has(.vni-progress-page) {
      height: auto !important;
      min-height: 100%;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      overscroll-behavior: auto !important;
    }
  }
}

.vni-progress-page,
.vni-progress-page * {
  box-sizing: border-box;
}

.vni-progress-page {
  position: relative;
  left: auto;
  width: 100%;
  min-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  min-height: 100dvh;
  transform: none;
  margin: 0;
  background: #0C1014;
  padding: 6px 0 0;
  color: #e8edf5;
  overflow-x: hidden;
  overflow-y: hidden;
  overscroll-behavior: none;
}

.vni-progress-container {
  width: calc(100% - 24px);
  max-width: 1963px;
  margin: 0 auto;
  padding: 0;
  background: transparent;
  transform: none;
  transform-origin: top center;
}

.vni-progress-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vni-progress-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  margin-bottom: 0;
}

.vni-progress-title {
  margin: 0;
  color: #f2f5fa;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.025em;
}

.vni-progress-subtitle {
  margin: 9px 0 0;
  color: #aab4c2;
  font-size: 13px;
  line-height: 1.35;
}

.vni-progress-panel {
  border: 1px solid #122033;
  border-radius: 8px;
  background: #161C23;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.018);
}

.vni-progress-pace {
  width: 352px;
  min-width: 352px;
  height: 62px;
  padding: 10px 14px;
  background: #161C23;
}

.vni-progress-pace-title {
  margin-bottom: 7px;
  color: #eef3fb;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
}

.vni-progress-pace-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.vni-progress-pace-button {
  height: 23px;
  border: 1px solid #17263a;
  border-radius: 5px;
  background: #060d18;
  color: #d2d9e4;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}

.vni-progress-pace-button:hover {
  border-color: #294263;
  background: #081522;
}

.vni-progress-pace-button.is-active {
  border-color: #1f64f2;
  background: #124ce6;
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.vni-progress-domain {
  min-height: 145px;
  padding: 19px 24px;
  background: #161C23;
}

.vni-progress-domain-grid {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  align-items: center;
  gap: 30px;
}

.vni-progress-domain-title {
  color: #eef3fb;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.vni-progress-domain-number {
  margin-top: 10px;
  color: #2d8bff;
  font-size: 48px;
  font-weight: 700;
  line-height: 0.86;
  letter-spacing: -0.04em;
}

.vni-progress-domain-label {
  margin-top: 6px;
  color: #eef3fb;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
}

.vni-progress-domain-total {
  margin-top: 7px;
  color: #aab4c2;
  font-size: 12px;
  line-height: 1;
}

.vni-progress-percent-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 11px;
  color: #e8edf5;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

.vni-progress-bar {
  width: 100%;
  height: 20px;
  overflow: hidden;
  border-radius: 4px;
  background: #121f31;
}

.vni-progress-bar-fill {
  display: flex;
  width: 100%;
  height: 100%;
}

.vni-progress-bar-segment {
  height: 100%;
  min-width: 0;
}

.vni-progress-legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  color: #aab4c2;
  font-size: 11px;
  line-height: 1;
}

.vni-progress-legend-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  white-space: nowrap;
}

.vni-progress-legend-dot {
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
  border-radius: 999px;
}

.vni-progress-domain-note {
  margin: 13px 0 0;
  color: #aab4c2;
  font-size: 12px;
  line-height: 1;
  text-align: center;
}

.vni-progress-metrics,
.vni-progress-lists {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.vni-progress-metric-card,
.vni-progress-list-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #122033;
  border-radius: 8px;
  background: #161C23;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.018);
}

.vni-progress-metric-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 5px;
  bottom: 5px;
  width: 1px;
  background: var(--accent-color);
  border-radius: 999px;
}

.vni-progress-list-card::before {
  display: none;
  content: none;
}

.vni-progress-metric-card {
  height: 125px;
  padding: 18px 20px;
}

.vni-progress-metric-content {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.vni-progress-metric-icon {
  display: flex;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--icon-bg);
  color: var(--accent-color);
}

.vni-progress-metric-title {
  margin: 0;
  color: #eef3fb;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.15;
}

.vni-progress-metric-value {
  margin-top: 3px;
  color: var(--value-color, var(--accent-color));
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

.vni-progress-metric-description {
  margin: 5px 0 0;
  color: #aab4c2;
  font-size: 12px;
  line-height: 1.25;
}

.vni-progress-list-card {
  height: 290px;
  padding: 16px 18px;
}

.vni-progress-list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.vni-progress-list-title {
  margin: 0;
  color: var(--accent-color);
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
}

.vni-progress-list-description {
  max-width: 205px;
  margin: 7px 0 0;
  color: #aab4c2;
  font-size: 11px;
  line-height: 1.35;
}

.vni-progress-list-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  margin-top: 1px;
  color: var(--accent-color);
}

.vni-progress-list-body {
  height: 212px;
  max-height: 212px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: #26364b transparent;
  overscroll-behavior: contain;
}

.vni-progress-list-body::-webkit-scrollbar {
  width: 5px;
}

.vni-progress-list-body::-webkit-scrollbar-track {
  background: transparent;
}

.vni-progress-list-body::-webkit-scrollbar-thumb {
  background: #26364b;
  border-radius: 999px;
}

.vni-progress-list-body::-webkit-scrollbar-thumb:hover {
  background: #34465f;
}

.vni-progress-empty {
  padding: 8px 0;
  color: #8e99a8;
  font-size: 12px;
  line-height: 1.3;
}

.vni-progress-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vni-progress-list-item {
  display: flex;
  min-height: 24px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #122033;
  padding: 4px 0;
  color: #aab4c2;
  font-size: 11px;
  line-height: 1;
  overflow: visible;
}

.vni-progress-list-card.is-reinforce .vni-progress-list-item {
  border-bottom-color: #24182a;
}

.vni-progress-list-item:last-child {
  border-bottom: 0;
}

.vni-progress-term {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #e8edf5;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vni-progress-count {
  flex: 0 0 auto;
  color: #aab4c2;
  white-space: nowrap;
}

.vni-progress-ratio {
  width: 34px;
  flex: 0 0 34px;
  color: #aab4c2;
  text-align: right;
  white-space: nowrap;
}

.vni-progress-mini-bar {
  width: 88px;
  height: 5px;
  flex: 0 0 88px;
  overflow: hidden;
  border-radius: 999px;
  background: #1d2d42;
}

.vni-progress-mini-fill {
  height: 100%;
  border-radius: 999px;
  background: #2d8bff;
}

.vni-progress-badge {
  flex: 0 0 auto;
  border-radius: 4px;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.vni-progress-badge.is-dominated {
  background: #0d3b28;
  color: #29AE67;
}

.vni-progress-badge.is-reinforce {
  background: #341222;
  color: #FA2137;
}

.vni-progress-badge.is-new {
  background: #1b2534;
  color: #c8cfda;
}

.vni-progress-summary {
  min-height: 92px;
  padding: 15px 24px;
  background: #161C23;
}

.vni-progress-summary-title {
  margin: 0 0 10px;
  color: #eef3fb;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.vni-progress-summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.vni-progress-summary-item {
  min-width: 0;
  padding: 0 16px;
  text-align: center;
}

.vni-progress-summary-item + .vni-progress-summary-item {
  border-left: 1px solid #24344a;
}

.vni-progress-summary-number {
  font-size: 21px;
  font-weight: 700;
  line-height: 1;
}

.vni-progress-summary-label {
  margin-top: 6px;
  color: #aab4c2;
  font-size: 12px;
  line-height: 1;
}

.vni-progress-loading {
  display: flex;
  min-height: calc(100vh - 0px);
  align-items: center;
  justify-content: center;
  background: #0C1014;
}

.vni-progress-spinner {
  width: 32px;
  height: 32px;
  border: 4px solid #17253b;
  border-top-color: #2d8bff;
  border-radius: 999px;
  animation: vni-progress-spin 900ms linear infinite;
}

@keyframes vni-progress-spin {
  to {
    transform: rotate(360deg);
  }
}


/* Light mode somente quando o app NÃO estiver em dark mode */
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-page {
  background: #ffffff;
  color: #172033;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-title {
  color: #101827;
  text-shadow: none;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-subtitle {
  color: #5f6f84;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-panel,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metric-card,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-card {
  border-color: #d7e1ee;
  background: linear-gradient(180deg, #ffffff 0%, #f9fbfe 100%);
  box-shadow:
    0 18px 46px rgba(31, 50, 81, 0.08),
    0 2px 8px rgba(31, 50, 81, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-pace {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border-color: #d7e1ee;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-pace-title,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-domain-title,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-domain-label,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metric-title,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary-title {
  color: #111827;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-pace-button {
  border-color: #d6e0ec;
  background: #f6f9fd;
  color: #2f3d52;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-pace-button:hover {
  border-color: #b9c9dd;
  background: #eef5fd;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-pace-button.is-active {
  border-color: #1f64f2;
  background: linear-gradient(180deg, #2f7dff 0%, #1557e6 100%);
  color: #ffffff;
  box-shadow:
    0 6px 14px rgba(45, 139, 255, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-domain,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary {
  background: linear-gradient(180deg, #ffffff 0%, #f9fbfe 100%);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-domain-number {
  color: #1f7bf2;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-domain-total,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-domain-note,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-legend,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metric-description,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-description,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-count,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-ratio,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary-label,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-empty {
  color: #64748b;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-percent-row {
  color: #243247;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-bar {
  background: #e6edf6;
  box-shadow: inset 0 1px 2px rgba(31, 50, 81, 0.08);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-domain-grid > div:first-child::after {
  background: #cbd5e1;
  opacity: 1;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metric-icon {
  background: color-mix(in srgb, var(--accent-color) 13%, #ffffff);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metrics .vni-progress-metric-card:nth-child(2) .vni-progress-metric-icon {
  background: #fdecef;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-title {
  color: var(--accent-color);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-term {
  color: #172033;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-item {
  border-bottom-color: #e3eaf3;
  color: #64748b;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-card.is-reinforce .vni-progress-list-item {
  border-bottom-color: #f0d7dc;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-mini-bar {
  background: #dce7f4;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-mini-fill {
  background: #2d8bff;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-badge.is-dominated {
  background: #e8f7ef;
  color: #16884a;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-badge.is-reinforce {
  background: #fdecef;
  color: #bd3142;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-badge.is-new {
  background: #eef2f7;
  color: #5b6676;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary-item + .vni-progress-summary-item {
  border-left-color: #d7e1ee;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary-number {
  text-shadow: none;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-body {
  scrollbar-color: #c1ccda transparent;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-body::-webkit-scrollbar-thumb {
  background: #c1ccda;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-body::-webkit-scrollbar-thumb:hover {
  background: #9eacbf;
}

@media (max-width: 640px) {
  html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-page {
    background: #ffffff;
  }

  html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-panel,
  html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metric-card,
  html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-list-card {
    border-color: #dce5f0;
    background: #ffffff;
    box-shadow: 0 12px 28px rgba(31, 50, 81, 0.07);
  }
}


/* Light mode: corrigir contraste dos números do resumo do aprendizado */
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary-item:first-child .vni-progress-summary-number {
  color: #172033 !important;
  opacity: 1 !important;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary-item .vni-progress-summary-number {
  opacity: 1 !important;
}

/* Ajuste final: aumentar apenas no desktop todas as caixas de contexto em mais 10% */
@media (min-width: 641px) {
  .vni-progress-domain {
    min-height: 160px;
    padding-top: 21px;
    padding-bottom: 21px;
  }

  .vni-progress-metric-card {
    height: 138px;
  }

  .vni-progress-list-card {
    height: 319px;
  }

  .vni-progress-list-body {
    height: 241px;
    max-height: 241px;
  }

  .vni-progress-summary {
    min-height: 101px;
  }
}


/* Regra de seleção/cópia de texto */
.vni-progress-page,
.vni-progress-page * {
  -webkit-user-select: none;
  user-select: none;
}

@media (min-width: 641px) {
  .vni-progress-lists .vni-progress-term {
    -webkit-user-select: text;
    user-select: text;
    cursor: text;
  }
}

@media (max-width: 640px) {
  .vni-progress-page,
  .vni-progress-page * {
    -webkit-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none;
  }
}


/* Dark mode: suavizar o vermelho da área "Precisam de reforço" */
.vni-progress-metrics .vni-progress-metric-card:nth-child(2)::before {
  background: #b85e69;
}

.vni-progress-metrics .vni-progress-metric-card:nth-child(2) .vni-progress-metric-value {
  color: #d06a76;
}

.vni-progress-metrics .vni-progress-metric-card:nth-child(2) .vni-progress-metric-icon {
  background: #281b20;
  color: #d06a76;
}

.vni-progress-lists .vni-progress-list-card:nth-child(2) .vni-progress-list-title,
.vni-progress-lists .vni-progress-list-card:nth-child(2) .vni-progress-list-icon {
  color: #d06a76;
}

.vni-progress-lists .vni-progress-list-card:nth-child(2) .vni-progress-list-item {
  border-bottom-color: #2c2328;
}

.vni-progress-badge.is-reinforce {
  background: #3a252b;
  color: #d98a94;
}

/* Light mode preservado sem mudança visual agressiva */
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metrics .vni-progress-metric-card:nth-child(2)::before {
  background: #FA2137;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metrics .vni-progress-metric-card:nth-child(2) .vni-progress-metric-value {
  color: #FA2137;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-metrics .vni-progress-metric-card:nth-child(2) .vni-progress-metric-icon {
  background: #ffe8ec;
  color: #FA2137;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-lists .vni-progress-list-card:nth-child(2) .vni-progress-list-title,
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-lists .vni-progress-list-card:nth-child(2) .vni-progress-list-icon {
  color: #FA2137;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-lists .vni-progress-list-card:nth-child(2) .vni-progress-list-item {
  border-bottom-color: #f3d5dc;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-badge.is-reinforce {
  background: #ffe8ec;
  color: #FA2137;
}


/* Dark mode: aplicar o mesmo vermelho suavizado no número do resumo "Precisam de reforço" */
.vni-progress-summary-item:nth-child(4) .vni-progress-summary-number {
  color: #d06a76 !important;
}

/* Light mode preservado */
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-summary-item:nth-child(4) .vni-progress-summary-number {
  color: #FA2137 !important;
}


/* Linha divisória vertical do bloco superior */
.vni-progress-domain-grid > div:first-child {
  position: relative;
}

.vni-progress-domain-grid > div:first-child::after {
  content: "";
  position: absolute;
  top: -10px;
  bottom: -10px;
  right: 8px;
  width: 1px;
  border-radius: 999px;
  background: #566173;
  opacity: 0.9;
}

/* No mobile, remove a linha para não quebrar o empilhamento do layout */
@media (max-width: 640px) {
  .vni-progress-domain-grid > div:first-child::after {
    display: none;
  }
}


/* Botão Resetar progresso */
.vni-progress-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vni-progress-reset-button {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #2b3542;
  border-radius: 8px;
  background: #161C23;
  color: #cbd5e1;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 140ms ease;
  -webkit-user-select: none;
  user-select: none;
}

.vni-progress-reset-button:hover {
  border-color: #d06a76;
  background: #201920;
  color: #f0c2c8;
}

.vni-progress-reset-button:active {
  transform: translateY(1px);
}

.vni-progress-reset-button.is-mobile {
  display: none;
}

/* Light mode do botão reset */
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-button {
  border-color: #d7e1ee;
  background: #ffffff;
  color: #405066;
  box-shadow: 0 10px 24px rgba(31, 50, 81, 0.06);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-button:hover {
  border-color: #d8a4ac;
  background: #fff7f8;
  color: #bd3142;
}

@media (max-width: 640px) {
  .vni-progress-header-actions {
    width: 100%;
  }

  .vni-progress-reset-button.is-desktop {
    display: none;
  }

  .vni-progress-reset-button.is-mobile {
    display: inline-flex;
    width: 100%;
    margin-top: 10px;
  }
}


/* Modal personalizada de confirmação do Resetar progresso */
.vni-progress-reset-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  padding: 20px;
  backdrop-filter: blur(2px);
}

.vni-progress-reset-modal {
  width: min(460px, calc(100vw - 32px));
  border: 1px solid #263241;
  border-radius: 10px;
  background: #0b1017;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  padding: 24px 24px 22px;
  color: #e8edf5;
}

.vni-progress-reset-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vni-progress-reset-modal-icon {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  align-items: center;
  justify-content: center;
  color: #ef4444;
}

.vni-progress-reset-modal-title {
  margin: 0;
  color: #f3f6fb;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
}

.vni-progress-reset-modal-text {
  margin: 14px 0 0;
  color: #b8c2d1;
  font-size: 14px;
  line-height: 1.45;
}

.vni-progress-reset-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.vni-progress-reset-modal-button {
  display: inline-flex;
  height: 38px;
  min-width: 92px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 140ms ease;
}

.vni-progress-reset-modal-button:active {
  transform: translateY(1px);
}

.vni-progress-reset-modal-button.is-cancel {
  border: 1px solid #2d3a4a;
  background: #0d141d;
  color: #f0f4fa;
}

.vni-progress-reset-modal-button.is-cancel:hover {
  border-color: #44546a;
  background: #121b26;
}

.vni-progress-reset-modal-button.is-reset {
  border: 1px solid #dc2626;
  background: #e62d36;
  color: #ffffff;
}

.vni-progress-reset-modal-button.is-reset:hover {
  border-color: #ef4444;
  background: #f03842;
}

/* Light mode da modal de reset */
html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-modal-overlay {
  background: rgba(15, 23, 42, 0.58);
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-modal {
  border-color: #d7e1ee;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(31, 50, 81, 0.22);
  color: #172033;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-modal-title {
  color: #111827;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-modal-text {
  color: #516177;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-modal-button.is-cancel {
  border-color: #d7e1ee;
  background: #ffffff;
  color: #172033;
}

html:not(.dark) body:not(.dark) #root:not(.dark) .vni-progress-reset-modal-button.is-cancel:hover {
  border-color: #b9c9dd;
  background: #f6f9fd;
}



/* Ajuste final: context boxes inferiores 20% menores, com 6 itens visíveis e scroll interno */
.vni-progress-list-card {
  height: 232px;
}

.vni-progress-list-body {
  height: 154px;
  max-height: 154px;
  overflow-x: hidden;
  overflow-y: auto;
}

.vni-progress-list-item {
  min-height: 24px;
  padding-top: 3px;
  padding-bottom: 3px;
}

@media (min-width: 641px) {
  .vni-progress-list-card {
    height: 255px;
  }

  .vni-progress-list-body {
    height: 177px;
    max-height: 177px;
  }
}

@media (max-width: 640px) {
  .vni-progress-list-card {
    height: 232px;
  }

  .vni-progress-list-body {
    height: 154px;
    max-height: 154px;
  }
}


/* Ajuste: centralizar a primeira área do Resumo do aprendizado */
.vni-progress-summary-title {
  width: 20%;
  text-align: center;
}

.vni-progress-summary-grid .vni-progress-summary-item:first-child {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

@media (max-width: 640px) {
  .vni-progress-summary-title {
    width: 100%;
    text-align: center;
  }
}


/* Web: travado sem zoom; libera scroll apenas quando JS detectar zoom aumentado + overflow real */
@media (min-width: 641px) {
  .vni-progress-page.is-zoom-scroll-enabled {
    height: auto;
    max-height: none;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: auto;
  }

  .vni-progress-page.is-zoom-scroll-enabled .vni-progress-container {
    padding-bottom: 6px;
  }
}

@media (max-width: 1190px) {
  .vni-progress-container {
    padding: 0 18px;
  }
}

@media (max-width: 1023px) {
  .vni-progress-page {
    width: 100%;
    min-width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    min-height: 100dvh;
    padding-top: 6px;
    overflow: hidden;
  }

  .vni-progress-container {
    transform: none;
  }

  .vni-progress-header {
    flex-direction: column;
  }

  .vni-progress-pace {
    width: 100%;
    min-width: 0;
  }

  .vni-progress-domain-grid {
    grid-template-columns: 1fr;
  }

  .vni-progress-metrics,
  .vni-progress-lists {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .vni-progress-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 16px;
  }

  .vni-progress-summary-item + .vni-progress-summary-item {
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .vni-progress-page {
    width: 100%;
    min-width: 100%;
    height: auto !important;
    max-height: none !important;
    min-height: 100dvh;
    padding: 6px 0 40px;
    overflow-x: hidden !important;
    overflow-y: visible !important;
    overscroll-behavior: auto !important;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }

  .vni-progress-container {
    width: calc(100% - 4px);
    max-width: none;
    margin-left: 2px;
    margin-right: 2px;
    padding: 0;
  }

  .vni-progress-panel,
  .vni-progress-metric-card,
  .vni-progress-list-card {
    width: 100%;
  }

  .vni-progress-summary {
    display: none;
  }

  .vni-progress-title {
    font-size: 28px;
  }

  .vni-progress-metrics,
  .vni-progress-lists,
  .vni-progress-summary-grid {
    grid-template-columns: 1fr;
  }

  .vni-progress-domain {
    padding: 16px;
  }

  .vni-progress-legend {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .vni-progress-legend-item {
    justify-content: center;
  }

  .vni-progress-summary-item {
    padding: 0;
  }
}
`;

function formatPercent(value) {
  return `${Math.round(Number.isFinite(value) ? value : 0)}%`;
}

function getPercent(part, total) {
  if (!total || total <= 0) return 0;
  return (part / total) * 100;
}

function pluralize(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getStatsNumber(stats, keys = []) {
  for (const key of keys) {
    const value = Number(stats?.[key]);

    if (Number.isFinite(value)) return value;
  }

  return 0;
}

function getCorrectStreak(item) {
  return getStatsNumber(item?.stats, [
    "correct_streak",
    "correctStreak",
    "streak",
    "consecutive_correct",
    "consecutiveCorrect",
  ]);
}

function getIncorrectCount(item) {
  return getStatsNumber(item?.stats, ["incorrect", "errors", "wrong"]);
}

function getCorrectCount(item) {
  return getStatsNumber(item?.stats, ["correct", "right"]);
}

function getTimestampValue(item, keys = []) {
  const stats = item?.stats || {};

  for (const key of keys) {
    const value = stats[key] ?? item?.[key];

    if (!value) continue;

    const timestamp =
      typeof value === "number" ? value : new Date(value).getTime();

    if (Number.isFinite(timestamp)) return timestamp;
  }

  return 0;
}

function getRegistrationTimestamp(item) {
  return getTimestampValue(item, [
    "created_at",
    "createdAt",
    "inserted_at",
    "registered_at",
    "updated_at",
  ]);
}

function getCreatedTimestamp(item) {
  return getTimestampValue(item, [
    "created_at",
    "createdAt",
    "inserted_at",
    "registered_at",
  ]);
}

function getRecentNewVocabularyItems(
  items = [],
  { limit, daysWindow = RECENT_NEW_WORDS_WINDOW_DAYS } = {}
) {
  const now = Date.now();
  const safeWindowDays = Math.max(
    1,
    Math.floor(Number(daysWindow) || RECENT_NEW_WORDS_WINDOW_DAYS)
  );
  const windowMs = safeWindowDays * DAY_IN_MS;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : null;

  const recentItems = (Array.isArray(items) ? items : [])
    .filter((item) => {
      if (String(item?.term || "").trim().length <= 0) return false;
      const createdTimestamp = getCreatedTimestamp(item);
      if (!Number.isFinite(createdTimestamp) || createdTimestamp <= 0) return false;
      return now - createdTimestamp <= windowMs;
    })
    .sort((a, b) => {
      const createdDiff = getCreatedTimestamp(b) - getCreatedTimestamp(a);
      if (createdDiff !== 0) return createdDiff;

      const updatedDiff =
        getTimestampValue(b, ["updated_at", "updatedAt"]) -
        getTimestampValue(a, ["updated_at", "updatedAt"]);
      if (updatedDiff !== 0) return updatedDiff;

      return String(b?.id || "").localeCompare(String(a?.id || ""));
    });

  return safeLimit ? recentItems.slice(0, safeLimit) : recentItems;
}

function getDominatedTimestamp(item) {
  return getTimestampValue(item, [
    "mastered_at",
    "dominated_at",
    "last_correct_at",
    "last_reviewed_at",
    "last_review_at",
    "lastReviewedAt",
    "reviewed_at",
    "updated_at",
    "created_at",
  ]);
}

function getProgressCategoryData(items = []) {
  const dominatedWords = [];
  const learningWords = [];
  const needsAttentionWords = [];
  const newWords = [];

  items.forEach((item) => {
    const correctStreak = getCorrectStreak(item);
    const incorrect = getIncorrectCount(item);

    if (correctStreak >= 10) {
      dominatedWords.push(item);
      return;
    }

    if (correctStreak >= 5) {
      learningWords.push(item);
      return;
    }

    if (incorrect > 0) {
      needsAttentionWords.push(item);
      return;
    }

    newWords.push(item);
  });

  learningWords.sort((a, b) => {
    const streakDiff = getCorrectStreak(b) - getCorrectStreak(a);
    if (streakDiff !== 0) return streakDiff;

    const correctDiff = getCorrectCount(b) - getCorrectCount(a);
    if (correctDiff !== 0) return correctDiff;

    return getRegistrationTimestamp(b) - getRegistrationTimestamp(a);
  });

  dominatedWords.sort(
    (a, b) => getDominatedTimestamp(b) - getDominatedTimestamp(a)
  );

  needsAttentionWords.sort((a, b) => {
    const incorrectDiff = getIncorrectCount(b) - getIncorrectCount(a);
    if (incorrectDiff !== 0) return incorrectDiff;

    return getRegistrationTimestamp(b) - getRegistrationTimestamp(a);
  });

  newWords.sort(
    (a, b) => getRegistrationTimestamp(b) - getRegistrationTimestamp(a)
  );

  return {
    dominated: dominatedWords.length,
    learning: learningWords.length,
    difficult: needsAttentionWords.length,
    fresh: newWords.length,
    totalCards: items.length,
    dominatedWords,
    learningWords,
    needsAttentionWords,
    newWords,
  };
}

function EmptyListState({ text }) {
  return <div className="vni-progress-empty">{text}</div>;
}

function MetricCard({
  title,
  value,
  description,
  icon,
  accentColor,
  iconBackground,
  valueColor,
}) {
  return (
    <div
      className="vni-progress-metric-card"
      style={{
        "--accent-color": accentColor,
        "--icon-bg": iconBackground,
        "--value-color": valueColor || accentColor,
      }}
    >
      <div className="vni-progress-metric-content">
        <div className="vni-progress-metric-icon">{icon}</div>

        <div>
          <h3 className="vni-progress-metric-title">{title}</h3>
          <div className="vni-progress-metric-value">{value}</div>
          <p className="vni-progress-metric-description">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ProgressListFrame({
  title,
  accentColor,
  description,
  icon,
  children,
  reinforce = false,
}) {
  return (
    <div
      className={`vni-progress-list-card ${reinforce ? "is-reinforce" : ""}`}
      style={{ "--accent-color": accentColor }}
    >
      <div className="vni-progress-list-header">
        <div>
          <h3 className="vni-progress-list-title">{title}</h3>
          <p className="vni-progress-list-description">{description}</p>
        </div>

        <div className="vni-progress-list-icon">{icon}</div>
      </div>

      <div className="vni-progress-list-body">{children}</div>
    </div>
  );
}

export default function Progress() {
  const { user } = useAuth();

  const [vocabItems, setVocabItems] = useState([]);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [reviewPreferences, setReviewPreferences] = useState(() =>
    loadReviewPreferences()
  );
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [allowDesktopPageScroll, setAllowDesktopPageScroll] = useState(false);

  const pageRef = useRef(null);
  const containerRef = useRef(null);
  const initialDprRef = useRef(
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  );
  const zoomGestureDetectedRef = useRef(false);

  const selectedPace = reviewPreferences.pace || REVIEW_PACE.EQUILIBRADO;

  const loadProgress = useCallback(async () => {
    try {
      setLoading(true);
      const activePreferences = loadReviewPreferences();

      if (!user?.id) {
        setVocabItems([]);
        setProgress(getProgressSummary([], activePreferences));
        return;
      }

      const { data, error } = await supabase
        .from("vocabulary")
        .select("id, term, stats, created_at, updated_at")
        .eq("user_id", user.id);

      if (error) throw error;

      const normalizedItems = (Array.isArray(data) ? data : []).map((row) => ({
        ...normalizeVocabularyItem(row, activePreferences),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      setVocabItems(normalizedItems);
    } catch (error) {
      console.error("Erro ao carregar progresso:", error);
      setVocabItems([]);
      setProgress(EMPTY_PROGRESS);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProgress();
    window.addEventListener("focus", loadProgress);

    return () => {
      window.removeEventListener("focus", loadProgress);
    };
  }, [loadProgress]);

  useEffect(() => {
    setProgress(getProgressSummary(vocabItems, reviewPreferences));
  }, [vocabItems, reviewPreferences]);


  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frameId = null;

    const isDesktopViewport = () =>
      window.matchMedia("(min-width: 641px)").matches;

    const detectZoomIncrease = () => {
      const currentDpr = window.devicePixelRatio || 1;
      const visualViewportScale = window.visualViewport?.scale || 1;

      return (
        zoomGestureDetectedRef.current ||
        currentDpr > initialDprRef.current + 0.08 ||
        visualViewportScale > 1.01
      );
    };

    const syncDesktopScrollRule = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        const pageNode = pageRef.current;
        const containerNode = containerRef.current;

        if (!pageNode || !containerNode || !isDesktopViewport()) {
          setAllowDesktopPageScroll(false);
          return;
        }

        const viewportHeight =
          window.visualViewport?.height || window.innerHeight || 0;
        const contentHeight = containerNode.getBoundingClientRect().height;
        const meaningfulOverflow = contentHeight - viewportHeight > 80;
        const zoomIsReallyIncreased = detectZoomIncrease();

        setAllowDesktopPageScroll(zoomIsReallyIncreased && meaningfulOverflow);
      });
    };

    const handleZoomShortcut = (event) => {
      const key = event.key?.toLowerCase();
      const isZoomKey =
        (event.ctrlKey || event.metaKey) &&
        (key === "+" || key === "=" || key === "-" || key === "0");

      if (!isZoomKey) return;

      zoomGestureDetectedRef.current = key !== "0";
      window.setTimeout(syncDesktopScrollRule, 160);
    };

    const handleWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;

      zoomGestureDetectedRef.current = true;
      window.setTimeout(syncDesktopScrollRule, 160);
    };

    syncDesktopScrollRule();

    window.addEventListener("resize", syncDesktopScrollRule);
    window.addEventListener("orientationchange", syncDesktopScrollRule);
    window.addEventListener("keydown", handleZoomShortcut);
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.visualViewport?.addEventListener("resize", syncDesktopScrollRule);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("resize", syncDesktopScrollRule);
      window.removeEventListener("orientationchange", syncDesktopScrollRule);
      window.removeEventListener("keydown", handleZoomShortcut);
      window.removeEventListener("wheel", handleWheel);
      window.visualViewport?.removeEventListener("resize", syncDesktopScrollRule);
    };
  }, [vocabItems.length, loading]);

  const handleReviewPaceChange = (pace) => {
    if (pace === selectedPace) return;
    const nextPreferences = saveReviewPreferences({ pace });
    setReviewPreferences(nextPreferences);
  };

  const handleResetProgress = () => {
    if (!user?.id) return;
    setShowResetModal(true);
  };

  const confirmResetProgress = async () => {
    if (!user?.id) return;

    try {
      setShowResetModal(false);
      setLoading(true);

      const resetStats = {
        correct: 0,
        incorrect: 0,
        correct_streak: 0,
        last_reviewed_at: null,
        last_review_at: null,
        mastered_at: null,
        dominated_at: null,
        correctStreak: 0,
        consecutive_correct: 0,
        consecutiveCorrect: 0,
      };

      const { error } = await supabase
        .from("vocabulary")
        .update({ stats: resetStats })
        .eq("user_id", user.id);

      if (error) throw error;

      clearCachedVocabularyRows(user.id);
      markVocabularyCacheForRefresh(user.id);

      await loadProgress();
    } catch (error) {
      console.error("Erro ao resetar progresso:", error);
      window.alert("Não foi possível resetar o progresso agora.");
    } finally {
      setLoading(false);
    }
  };

  const progressData = useMemo(
    () => getProgressCategoryData(vocabItems),
    [vocabItems]
  );

  const categoryValues = useMemo(
    () => ({
      dominated: progressData.dominated || 0,
      nearMastery: progressData.learning || 0,
      reinforce: progressData.difficult || 0,
      fresh: progressData.fresh || 0,
      total: progressData.totalCards || 0,
    }),
    [progressData]
  );

  const topBarCategories = useMemo(() => {
    const groups = [
      {
        key: "nearMastery",
        label: "Perto de dominar",
        count: categoryValues.nearMastery,
        color: COLORS.nearMastery,
        priority: 0,
      },
      {
        key: "reinforce",
        label: "Precisam de reforço",
        count: categoryValues.reinforce,
        color: COLORS.reinforce,
        priority: 1,
      },
      {
        key: "dominated",
        label: "Dominadas",
        count: categoryValues.dominated,
        color: COLORS.dominated,
        priority: 2,
      },
    ];
    const totalMainGroups = groups.reduce((sum, group) => sum + group.count, 0);

    return groups
      .slice()
      .sort((a, b) => {
        const countDiff = b.count - a.count;
        if (countDiff !== 0) return countDiff;
        return a.priority - b.priority;
      })
      .map((group) => ({
        ...group,
        percent: getPercent(group.count, totalMainGroups),
      }));
  }, [categoryValues.dominated, categoryValues.nearMastery, categoryValues.reinforce]);

  const topBarLeadingCategory = topBarCategories[0] || null;

  const masteryStreakTarget = 10;

  const orderedNearMasteryWords = progressData.learningWords || [];
  const orderedDominatedWords = progressData.dominatedWords || [];
  const orderedNeedsAttentionWords = progressData.needsAttentionWords || [];
  const recentNewWords = useMemo(() => getRecentNewVocabularyItems(vocabItems), [vocabItems]);
  const orderedNewWords = useMemo(() => recentNewWords.slice(0, 6), [recentNewWords]);

  if (loading) {
    return (
      <>
        <style>{PROGRESS_PAGE_CSS}</style>
        <div className="vni-progress-loading">
          <div className="vni-progress-spinner" />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{PROGRESS_PAGE_CSS}</style>

      <div
        ref={pageRef}
        className={`vni-progress-page ${
          allowDesktopPageScroll ? "is-zoom-scroll-enabled" : ""
        }`}
        data-scroll-unlocked={allowDesktopPageScroll ? "true" : "false"}
      >
        <div ref={containerRef} className="vni-progress-container">
          <div className="vni-progress-stack">
            <div className="vni-progress-header">
              <div>
                <h1 className="vni-progress-title">Progresso</h1>
                <p className="vni-progress-subtitle">
                  Acompanhe sua evolução real no domínio do vocabulário.
                </p>
              </div>

              <div className="vni-progress-header-actions">
                <button
                  type="button"
                  className="vni-progress-reset-button is-desktop"
                  onClick={handleResetProgress}
                >
                  <RotateCcw size={14} strokeWidth={2} />
                  Resetar progresso
                </button>

                <div className="vni-progress-panel vni-progress-pace">
                  <div className="vni-progress-pace-title">Ritmo de revisão</div>

                  <div className="vni-progress-pace-options">
                    {REVIEW_PACE_OPTIONS.map((option) => {
                      const isActive = selectedPace === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleReviewPaceChange(option.value)}
                          className={`vni-progress-pace-button ${
                            isActive ? "is-active" : ""
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <section className="vni-progress-panel vni-progress-domain">
              <div className="vni-progress-domain-grid">
                <div>
                  <div className="vni-progress-domain-title">Perto de dominar</div>

                  <div className="vni-progress-domain-number">
                    {categoryValues.nearMastery}
                  </div>

                  <div className="vni-progress-domain-label">palavras/frases perto de dominar</div>

                  <div className="vni-progress-domain-total">
                    de {categoryValues.total} palavras cadastradas
                  </div>
                </div>

                <div>
                  <div className="vni-progress-percent-row">
                    {topBarCategories.map((category) => (
                      <span key={`percent-${category.key}`}>
                        {formatPercent(category.percent)}
                      </span>
                    ))}
                  </div>

                  <div className="vni-progress-bar">
                    <div className="vni-progress-bar-fill">
                      {topBarCategories.map((category) => (
                        <div
                          key={`segment-${category.key}`}
                          className="vni-progress-bar-segment"
                          style={{
                            width: `${category.percent}%`,
                            backgroundColor: category.color,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="vni-progress-legend">
                    {topBarCategories.map((category) => (
                      <div
                        key={`legend-${category.key}`}
                        className="vni-progress-legend-item"
                      >
                        <span
                          className="vni-progress-legend-dot"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.label}
                      </div>
                    ))}
                  </div>

                  <p className="vni-progress-domain-note">
                    {topBarLeadingCategory
                      ? `${formatPercent(topBarLeadingCategory.percent)} do grupo principal está em ${topBarLeadingCategory.label.toLowerCase()}`
                      : "Sem dados suficientes para classificar no momento."}
                  </p>
                </div>
              </div>
            </section>

            <section className="vni-progress-metrics">
              <MetricCard
                title="Perto de dominar"
                value={categoryValues.nearMastery}
                description={
                  <>
                    Quase
                    <br />
                    dominadas.
                  </>
                }
                accentColor={COLORS.nearMastery}
                iconBackground="#0b2342"
                icon={<TrendingUp size={24} strokeWidth={2} />}
              />

              <MetricCard
                title="Precisam de reforço"
                value={categoryValues.reinforce}
                description={
                  <>
                    Que ainda
                    <br />
                    exigem atenção.
                  </>
                }
                accentColor={COLORS.reinforce}
                iconBackground="#31111d"
                icon={<CircleAlert size={24} strokeWidth={2} />}
              />

              <MetricCard
                title="Dominadas"
                value={categoryValues.dominated}
                description={
                  <>
                    Já memorizadas
                    <br />
                    com consistência.
                  </>
                }
                accentColor={COLORS.dominated}
                iconBackground="#0a2a1e"
                icon={<Trophy size={24} strokeWidth={2} />}
              />

              <MetricCard
                title="Novas"
                value={recentNewWords.length}
                description={
                  <>
                    Ainda no início
                    <br />
                    do aprendizado.
                  </>
                }
                accentColor="#566173"
                valueColor={COLORS.fresh}
                iconBackground="#151c2a"
                icon={<BookOpen size={24} strokeWidth={2} />}
              />
            </section>

            <section className="vni-progress-lists">
              <ProgressListFrame
                title="Perto de dominar"
                accentColor={COLORS.nearMastery}
                description="As que estão quase entrando no domínio."
                icon={<BarChart3 size={32} strokeWidth={2} />}
              >
                {orderedNearMasteryWords.length ? (
                  <ul className="vni-progress-list">
                    {orderedNearMasteryWords.map((item) => {
                      const streak = Math.max(
                        0,
                        Math.min(item.stats?.correct_streak || 0, masteryStreakTarget)
                      );
                      const streakPercent = masteryStreakTarget
                        ? (streak / masteryStreakTarget) * 100
                        : 0;

                      return (
                        <li key={item.id} className="vni-progress-list-item">
                          <span className="vni-progress-term">{item.term}</span>
                          <span className="vni-progress-ratio">
                            {streak}/{masteryStreakTarget}
                          </span>
                          <div className="vni-progress-mini-bar">
                            <div
                              className="vni-progress-mini-fill"
                              style={{ width: `${streakPercent}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyListState text="Nenhuma palavra perto de dominar no momento." />
                )}
              </ProgressListFrame>

              <ProgressListFrame
                title="Precisam de reforço"
                accentColor={COLORS.reinforce}
                description="As que mais precisam de reforço."
                icon={<CircleAlert size={32} strokeWidth={2} />}
                reinforce
              >
                {orderedNeedsAttentionWords.length ? (
                  <ul className="vni-progress-list">
                    {orderedNeedsAttentionWords.map((item) => {
                      const errors = getIncorrectCount(item);
                      return (
                        <li key={item.id} className="vni-progress-list-item">
                          <span className="vni-progress-term">{item.term}</span>
                          <span className="vni-progress-count">
                            {pluralize(errors, "erro", "erros")}
                          </span>
                          <span className="vni-progress-badge is-reinforce">
                            atenção
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyListState text="Nenhuma palavra pedindo reforço agora." />
                )}
              </ProgressListFrame>

              <ProgressListFrame
                title="Dominadas"
                accentColor={COLORS.dominated}
                description="As que você memorizou com consistência."
                icon={<Crown size={32} strokeWidth={2} />}
              >
                {orderedDominatedWords.length ? (
                  <ul className="vni-progress-list">
                    {orderedDominatedWords.map((item) => {
                      const streak = item.stats?.correct_streak || 0;
                      return (
                        <li key={item.id} className="vni-progress-list-item">
                          <span className="vni-progress-term">{item.term}</span>
                          <span className="vni-progress-count">
                            {pluralize(streak, "acerto seguido", "acertos seguidos")}
                          </span>
                          <span className="vni-progress-badge is-dominated">
                            dominada
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyListState text="Nenhuma palavra dominada ainda." />
                )}
              </ProgressListFrame>

              <ProgressListFrame
                title="Novas"
                accentColor="#566173"
                description="As que ainda estão no início do aprendizado."
                icon={<BookOpen size={32} strokeWidth={2} />}
              >
                {orderedNewWords.length ? (
                  <ul className="vni-progress-list">
                    {orderedNewWords.map((item) => (
                      <li key={item.id} className="vni-progress-list-item">
                        <span className="vni-progress-term">{item.term}</span>
                        <span className="vni-progress-badge is-new">nova</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyListState text="Nenhuma palavra nova cadastrada nos últimos 2 dias." />
                )}
              </ProgressListFrame>
            </section>

            <button
              type="button"
              className="vni-progress-reset-button is-mobile"
              onClick={handleResetProgress}
            >
              <RotateCcw size={14} strokeWidth={2} />
              Resetar progresso
            </button>

            <section className="vni-progress-panel vni-progress-summary">
              <h3 className="vni-progress-summary-title">Resumo do aprendizado</h3>

              <div className="vni-progress-summary-grid">
                <div className="vni-progress-summary-item">
                  <div className="vni-progress-summary-number" style={{ color: "#f2f5fa" }}>
                    {categoryValues.total}
                  </div>
                  <div className="vni-progress-summary-label">
                    palavra/frase cadastrada
                  </div>
                </div>

                <div className="vni-progress-summary-item">
                  <div
                    className="vni-progress-summary-number"
                    style={{ color: COLORS.dominated }}
                  >
                    {categoryValues.dominated}
                  </div>
                  <div className="vni-progress-summary-label">dominadas</div>
                </div>

                <div className="vni-progress-summary-item">
                  <div
                    className="vni-progress-summary-number"
                    style={{ color: COLORS.nearMastery }}
                  >
                    {categoryValues.nearMastery}
                  </div>
                  <div className="vni-progress-summary-label">perto de dominar</div>
                </div>

                <div className="vni-progress-summary-item">
                  <div
                    className="vni-progress-summary-number"
                    style={{ color: COLORS.reinforce }}
                  >
                    {categoryValues.reinforce}
                  </div>
                  <div className="vni-progress-summary-label">
                    precisam de reforço
                  </div>
                </div>

                <div className="vni-progress-summary-item">
                  <div
                    className="vni-progress-summary-number"
                    style={{ color: COLORS.fresh }}
                  >
                    {categoryValues.fresh}
                  </div>
                  <div className="vni-progress-summary-label">novas</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {showResetModal && (
        <div
          className="vni-progress-reset-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vni-progress-reset-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowResetModal(false);
            }
          }}
        >
          <div className="vni-progress-reset-modal">
            <div className="vni-progress-reset-modal-header">
              <div className="vni-progress-reset-modal-icon">
                <CircleAlert size={22} strokeWidth={2} />
              </div>

              <h2
                id="vni-progress-reset-modal-title"
                className="vni-progress-reset-modal-title"
              >
                Resetar progresso
              </h2>
            </div>

            <p className="vni-progress-reset-modal-text">
              Tem certeza que deseja resetar todo o progresso? Essa ação vai zerar
              seus acertos, erros e sequência de revisão das palavras e frases.
            </p>

            <div className="vni-progress-reset-modal-actions">
              <button
                type="button"
                className="vni-progress-reset-modal-button is-cancel"
                onClick={() => setShowResetModal(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="vni-progress-reset-modal-button is-reset"
                onClick={confirmResetProgress}
              >
                Resetar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
