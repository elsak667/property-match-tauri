/**
 * 全站 SVG 图标 — 基于 Heroicons (outline)
 * strokeWidth: 1.5，颜色通过 style 设为 CSS 变量
 */
import {
  RocketLaunchIcon, HomeIcon, DocumentTextIcon, BuildingOfficeIcon,
  ChartBarIcon, MapIcon, MagnifyingGlassIcon, XMarkIcon,
  Cog6ToothIcon, SparklesIcon, MapPinIcon, LightBulbIcon, StarIcon,
  ArrowDownTrayIcon, ExclamationTriangleIcon, CheckCircleIcon, CheckIcon,
  ArrowPathIcon, ChatBubbleLeftRightIcon, NewspaperIcon,
  UsersIcon, CalendarDaysIcon,
  BoltIcon,
  PaperAirplaneIcon, InformationCircleIcon, EyeSlashIcon,
  FunnelIcon, ChevronDownIcon, ArrowSmallRightIcon,
  ArrowsRightLeftIcon, RectangleGroupIcon, GlobeAmericasIcon,
  ArrowRightIcon, XCircleIcon, CheckBadgeIcon,
} from '@heroicons/react/24/outline';

type HProps = { className?: string; style?: React.CSSProperties };

function h(IconComponent: React.FC<HProps>, color: string, size = 15) {
  return (props: HProps = {}) => (
    <IconComponent
      className={props.className}
      style={{ width: size, height: size, color, ...props.style }}
    />
  );
}

const accent = 'var(--accent)';
const white = 'var(--text-1)';
const muted = 'var(--text-2)';
const dimmed = 'var(--text-3)';

export const Icon = {
  logo: h(RocketLaunchIcon, white, 20),
  home: h(HomeIcon, white),
  policy: h(DocumentTextIcon, white),
  property: h(BuildingOfficeIcon, white),
  invest: h(ChartBarIcon, white),
  industry: h(MapIcon, white),

  search: h(MagnifyingGlassIcon, accent),
  searchMuted: h(MagnifyingGlassIcon, muted),
  close: h(XMarkIcon, white),
  closeSm: h(XMarkIcon, white, 13),
  closeAccent: h(XMarkIcon, muted, 13),
  settings: h(Cog6ToothIcon, white),
  settingsAccent: h(Cog6ToothIcon, accent),
  filter: h(FunnelIcon, accent),
  alert: h(ExclamationTriangleIcon, dimmed),
  alertAccent: h(ExclamationTriangleIcon, accent),
  alertWhite: h(ExclamationTriangleIcon, white),
  lightbulb: h(LightBulbIcon, accent),
  lightbulbMuted: h(LightBulbIcon, muted),
  users: h(UsersIcon, white),
  usersAccent: h(UsersIcon, accent),
  calendarDays: h(CalendarDaysIcon, accent),
  star: h(StarIcon, dimmed, 12),
  starFilled: h(StarIcon, 'var(--warn)', 12),
  check: h(CheckIcon, accent),
  checkWhite: h(CheckIcon, white),
  checkCircle: h(CheckCircleIcon, white),
  checkCircleGreen: h(CheckCircleIcon, 'var(--success)', 40),
  checkBadge: h(CheckBadgeIcon, 'var(--success)', 14),
  info: h(InformationCircleIcon, accent),
  refresh: h(ArrowPathIcon, white),
  refreshAccent: h(ArrowPathIcon, accent),
  download: h(ArrowDownTrayIcon, accent),
  downloadWhite: h(ArrowDownTrayIcon, white),
  eye: h(EyeSlashIcon, dimmed),

  mapPin: h(MapPinIcon, dimmed),
  mapPinAccent: h(MapPinIcon, accent),
  mapPinWhite: h(MapPinIcon, white),
  building: h(BuildingOfficeIcon, white),
  buildingAccent: h(BuildingOfficeIcon, accent),
  buildingMuted: h(BuildingOfficeIcon, muted, 13),
  chart: h(ChartBarIcon, white),
  chartAccent: h(ChartBarIcon, accent),
  chartMuted: h(ChartBarIcon, muted, 13),
  file: h(DocumentTextIcon, accent),
  fileWhite: h(DocumentTextIcon, white),
  scrollText: h(DocumentTextIcon, white),
  scrollTextAccent: h(DocumentTextIcon, accent),
  scrollTextMuted: h(DocumentTextIcon, muted, 13),
  target: h(MapPinIcon, white),
  sparkles: h(SparklesIcon, white),
  sparklesAccent: h(SparklesIcon, accent),
  zap: h(BoltIcon, accent),
  zapAccent: h(BoltIcon, accent),
  xCircleAccent: h(XCircleIcon, accent),
  arrowRight: h(ArrowRightIcon, white),
  arrowRightAccent: h(ArrowRightIcon, accent),
  arrowRightSm: h(ArrowSmallRightIcon, accent, 14),
  loader: (props: HProps = {}) => (
    <ArrowPathIcon className={`animate-spin ${props.className ?? ''}`} style={{ width: 15, height: 15, color: accent }} />
  ),
  loaderWhite: (props: HProps = {}) => (
    <ArrowPathIcon className={`animate-spin ${props.className ?? ''}`} style={{ width: 15, height: 15, color: white }} />
  ),
  xCircle: h(XCircleIcon, dimmed),
  trending: h(ArrowsRightLeftIcon, white),
  layers: h(RectangleGroupIcon, white),
  globe: h(GlobeAmericasIcon, white),
  newspaper: h(NewspaperIcon, dimmed),
  newspaperWhite: h(NewspaperIcon, white),
  message: h(ChatBubbleLeftRightIcon, white),
  messageAccent: h(ChatBubbleLeftRightIcon, accent),
  bot: h(SparklesIcon, white),
  botAccent: h(SparklesIcon, accent),
  send: h(PaperAirplaneIcon, white),
  sendAccent: h(PaperAirplaneIcon, accent),
  chevronDown: h(ChevronDownIcon, dimmed, 13),
};