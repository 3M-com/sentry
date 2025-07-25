import {Fragment, isValidElement, useCallback, useContext, useMemo} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorage from 'sentry/utils/localStorage';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import type {SidebarOrientation} from './types';
import {SIDEBAR_NAVIGATION_SOURCE} from './utils';

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

const tooltipDisabledProps = {
  disabled: true,
};

export type SidebarItemProps = {
  /**
   * Icon to display
   */
  icon: React.ReactNode;
  /**
   * Key of the sidebar item. Used for label hooks
   */
  id: string;
  /**
   * Label to display (only when expanded)
   */
  label: React.ReactNode;
  /**
   * Sidebar is at "top" or "left" of screen
   */
  orientation: SidebarOrientation;
  /**
   * Is this sidebar item active
   */
  active?: boolean;
  /**
   * Additional badge to display after label
   */
  badge?: number;
  /**
   * Custom tooltip title for the badge
   */
  badgeTitle?: string;
  className?: string;
  /**
   * Is sidebar in a collapsed state
   */
  collapsed?: boolean;
  /**
   * Whether to use exact matching to detect active paths. If true, this item will only
   * be active if the current router path exactly matches the `to` prop. If false
   * (default), there will be a match for any router path that _starts with_ the `to`
   * prop.
   */
  exact?: boolean;
  hasNewNav?: boolean;
  /**
   * Sidebar has a panel open
   */
  hasPanel?: boolean;
  href?: string;
  index?: boolean;
  /**
   * Additional badge letting users know a tab is in alpha.
   */
  isAlpha?: boolean;

  /**
   * Additional badge letting users know a tab is in beta.
   */
  isBeta?: boolean;

  /**
   * Is main item in a floating accordion
   */
  isMainItem?: boolean;
  /**
   * Is this item nested within another item
   */
  isNested?: boolean;
  /**
   * Specify the variant for the badge.
   */
  isNew?: boolean;
  /**
   * An optional prefix that can be used to reset the "new" indicator
   */
  isNewSeenKeySuffix?: string;
  /**
   * Is this item expanded in the floating sidebar
   */
  isOpenInFloatingSidebar?: boolean;
  onClick?: (id: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
  search?: string;
  to?: string;
  /**
   * Content to render at the end of the item.
   */
  trailingItems?: React.ReactNode;
};

function SidebarItem({
  id,
  href,
  to,
  search,
  icon,
  label,
  badge,
  active,
  exact,
  hasPanel,
  isNew,
  isBeta,
  isAlpha,
  collapsed,
  className,
  orientation,
  isNewSeenKeySuffix,
  onClick,
  trailingItems,
  isNested,
  isMainItem,
  isOpenInFloatingSidebar,
  hasNewNav,
  badgeTitle,
  ...props
}: SidebarItemProps) {
  const theme = useTheme();
  const {setExpandedItemId, shouldAccordionFloat} = useContext(ExpandedContext);
  const router = useRouter();
  // label might be wrapped in a guideAnchor
  let labelString = label;
  if (isValidElement(label)) {
    labelString = (label?.props as any)?.children ?? label;
  }
  // If there is no active panel open and if path is active according to react-router
  const isActiveRouter =
    !hasPanel && router && isItemActive({to, label: labelString}, exact);

  // TODO: floating accordion should be transformed into secondary panel
  let isInFloatingAccordion = (isNested || isMainItem) && shouldAccordionFloat;
  if (hasNewNav) {
    isInFloatingAccordion = false;
  }
  const hasLink = Boolean(to);
  const isInCollapsedState = (!isInFloatingAccordion && collapsed) || hasNewNav;

  const isActive = defined(active) ? active : isActiveRouter;
  const isTop = orientation === 'top' && !isInFloatingAccordion;
  const placement = isTop ? 'bottom' : 'right';

  const seenSuffix = isNewSeenKeySuffix ?? '';
  const isNewSeenKey = `sidebar-new-seen:${id}${seenSuffix}`;
  const showIsNew =
    isNew && !localStorage.getItem(isNewSeenKey) && !(isInFloatingAccordion && !hasLink);

  const organization = useOrganization({allowNull: true});

  const recordAnalytics = useCallback(
    () => trackAnalytics('growth.clicked_sidebar', {item: id, organization}),
    [id, organization]
  );

  const toProps: LocationDescriptor = useMemo(() => {
    if (!to && !href) {
      return '#';
    }
    return {
      pathname: to ? to : href,
      search,
    };
  }, [to, href, search]);

  const badges = (
    <Fragment>
      {showIsNew && <FeatureBadge type="new" tooltipProps={{title: badgeTitle}} />}
      {isBeta && <FeatureBadge type="beta" tooltipProps={{title: badgeTitle}} />}
      {isAlpha && <FeatureBadge type="alpha" tooltipProps={{title: badgeTitle}} />}
    </Fragment>
  );

  const handleItemClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      setExpandedItemId(null);
      if (!to && !href) {
        event.preventDefault();
      }
      recordAnalytics();
      onClick?.(id, event);
      if (showIsNew) {
        localStorage.setItem(isNewSeenKey, 'true');
      }
    },
    [href, to, id, onClick, recordAnalytics, showIsNew, isNewSeenKey, setExpandedItemId]
  );

  return (
    <Tooltip
      disabled={
        (!isInCollapsedState && !isTop) ||
        (shouldAccordionFloat && isOpenInFloatingSidebar) ||
        hasNewNav
      }
      title={
        <Flex align="center">
          {label} {badges}
        </Flex>
      }
      position={placement}
    >
      <SidebarNavigationItemHook id={id}>
        {({additionalContent}) => (
          <StyledSidebarItem
            theme={theme}
            {...props}
            id={`sidebar-item-${id}`}
            isInFloatingAccordion={isInFloatingAccordion}
            active={isActive ? 'true' : undefined}
            to={toProps}
            state={{source: SIDEBAR_NAVIGATION_SOURCE}}
            disabled={!hasLink && isInFloatingAccordion}
            className={className}
            aria-current={isActive ? 'page' : undefined}
            onClick={handleItemClick}
            hasNewNav={hasNewNav}
          >
            {hasNewNav ? (
              <StyledInteractionStateLayer
                isPressed={isActive}
                color="white"
                higherOpacity
              />
            ) : (
              <InteractionStateLayer isPressed={isActive} color="white" higherOpacity />
            )}
            <SidebarItemWrapper collapsed={isInCollapsedState} hasNewNav={hasNewNav}>
              {!isInFloatingAccordion && (
                <SidebarItemIcon hasNewNav={hasNewNav}>{icon}</SidebarItemIcon>
              )}
              {!isInCollapsedState && !isTop && (
                <SidebarItemLabel
                  isInFloatingAccordion={isInFloatingAccordion}
                  isNested={isNested}
                >
                  <LabelHook id={id}>
                    <TruncatedLabel>{label}</TruncatedLabel>
                    {additionalContent ?? badges}
                  </LabelHook>
                </SidebarItemLabel>
              )}
              {isInCollapsedState && showIsNew && (
                <CollapsedFeatureBadge type="new" tooltipProps={tooltipDisabledProps} />
              )}
              {isInCollapsedState && isBeta && (
                <CollapsedFeatureBadge type="beta" tooltipProps={tooltipDisabledProps} />
              )}
              {isInCollapsedState && isAlpha && (
                <CollapsedFeatureBadge type="alpha" tooltipProps={tooltipDisabledProps} />
              )}
              {badge !== undefined && badge > 0 && (
                <SidebarItemBadge collapsed={isInCollapsedState}>
                  {badge}
                </SidebarItemBadge>
              )}
              {!isInFloatingAccordion && hasNewNav && (
                <LabelHook id={id}>
                  <TruncatedLabel hasNewNav={hasNewNav}>{label}</TruncatedLabel>
                  {additionalContent ?? badges}
                </LabelHook>
              )}
              {trailingItems}
            </SidebarItemWrapper>
          </StyledSidebarItem>
        )}
      </SidebarNavigationItemHook>
    </Tooltip>
  );
}
SidebarItem.displayName = 'SidebarItem';

export function isItemActive(
  item: Pick<SidebarItemProps, 'to' | 'label' | 'active'>,
  exact?: boolean
): boolean {
  if (typeof item.active === 'boolean') {
    return item.active;
  }
  // take off the query params for matching
  const toPathWithoutReferrer = item?.to?.split('?')[0];
  if (!toPathWithoutReferrer) {
    return false;
  }

  return (
    (exact
      ? location.pathname === normalizeUrl(toPathWithoutReferrer)
      : location.pathname.startsWith(normalizeUrl(toPathWithoutReferrer))) ||
    (item?.label === 'Discover' && location.pathname.includes('/discover/')) ||
    (item?.label === 'Dashboards' &&
      (location.pathname.includes('/dashboards/') ||
        location.pathname.includes('/dashboard/')) &&
      !location.pathname.startsWith('/settings/')) ||
    // TODO: this won't be necessary once we remove settingsHome
    (item?.label === 'Settings' && location.pathname.startsWith('/settings/')) ||
    (item?.label === 'Alerts' &&
      location.pathname.includes('/alerts/') &&
      !location.pathname.startsWith('/settings/')) ||
    (item?.label === 'Releases' && location.pathname.includes('/release-thresholds/')) ||
    (item?.label === 'Performance' &&
      location.pathname.startsWith('/performance/') &&
      !location.pathname.startsWith('/settings/'))
  );
}

const SidebarNavigationItemHook = HookOrDefault({
  hookName: 'sidebar:navigation-item',
  defaultComponent: ({children}) =>
    children({
      disabled: false,
      additionalContent: null,
      Wrapper: Fragment,
    }),
});

export default SidebarItem;

const getActiveStyle = ({
  active,
  theme,
  isInFloatingAccordion,
}: {
  theme: Theme;
  active?: string;
  hasNewNav?: boolean;
  isInFloatingAccordion?: boolean;
}) => {
  if (!active) {
    return '';
  }
  if (isInFloatingAccordion) {
    return css`
      &:active,
      &:focus,
      &:hover {
        color: ${isChonkTheme(theme) ? theme.subText : theme.gray400};
      }
    `;
  }
  return css`
    color: ${isChonkTheme(theme) ? theme.tokens.content.accent : theme.white};

    &:active,
    &:focus,
    &:hover {
      color: ${isChonkTheme(theme) ? theme.tokens.content.accent : theme.white};
    }

    &:before {
      background-color: ${!!theme && isChonkTheme(theme)
        ? theme.tokens.graphics.accent
        : theme.active};
    }
  `;
};

const StyledSidebarItem = styled(Link, {
  shouldForwardProp: p =>
    !['isInFloatingAccordion', 'hasNewNav', 'index', 'organization'].includes(p),
})`
  color: ${p =>
    isChonkTheme(p.theme)
      ? p.theme.subText
      : p.isInFloatingAccordion
        ? p.theme.gray400
        : 'inherit'};
  height: ${p => (p.isInFloatingAccordion ? '35px' : p.hasNewNav ? '40px' : '30px')};
  display: flex;
  position: relative;
  cursor: pointer;
  font-size: 15px;
  flex-shrink: 0;
  border-radius: ${p => p.theme.borderRadius};
  transition: none;
  ${p => {
    if (!p.hasNewNav) {
      return css`
        &:before {
          display: block;
          content: '';
          position: absolute;
          top: 4px;
          left: calc(-${space(2)} - 1px);
          bottom: 6px;
          width: 5px;
          border-radius: 0 3px 3px 0;
          background-color: transparent;
          transition: 0.15s background-color linear;
        }
      `;
    }
    return css`
      margin: ${space(2)} 0;
      width: 100px;
      align-self: center;
    `;
  }}

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    &:before {
      top: auto;
      left: 5px;
      bottom: -12px;
      height: 5px;
      width: auto;
      right: 5px;
      border-radius: 3px 3px 0 0;
    }
  }

  &:hover,
  &:focus-visible {
    ${p => {
      if (p.isInFloatingAccordion) {
        return css`
          background-color: ${p.theme.hover};
          color: ${isChonkTheme(p.theme) ? p.theme.subText : p.theme.gray400};
        `;
      }
      return css`
        color: ${isChonkTheme(p.theme) ? p.theme.colors.content.accent : p.theme.white};
      `;
    }}
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.purple300};
  }

  ${getActiveStyle};
`;

const SidebarItemWrapper = styled('div')<{collapsed?: boolean; hasNewNav?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  ${p => p.hasNewNav && 'flex-direction: column;'}
  ${p => !p.collapsed && `padding-right: ${space(1)};`}

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    padding-right: 0;
  }
`;

const SidebarItemIcon = styled('span')<{hasNewNav?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 37px;

  svg {
    display: block;
    margin: 0 auto;
    width: 18px;
    height: 18px;
  }
  ${p =>
    p.hasNewNav &&
    css`
      @media (max-width: ${p.theme.breakpoints.md}) {
        display: none;
      }
    `};
`;

const SidebarItemLabel = styled('span')<{
  isInFloatingAccordion?: boolean;
  isNested?: boolean;
}>`
  margin-left: ${p => (p.isNested && p.isInFloatingAccordion ? space(4) : '10px')};
  white-space: nowrap;
  opacity: 1;
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const TruncatedLabel = styled(TextOverflow)<{hasNewNav?: boolean}>`
  ${p =>
    !p.hasNewNav &&
    css`
      margin-right: auto;
    `}
`;

const getCollapsedBadgeStyle = ({
  collapsed,
  theme,
}: {
  collapsed: boolean | undefined;
  theme: Theme;
}) => {
  if (!collapsed) {
    return '';
  }

  return css`
    background: ${isChonkTheme(theme) ? theme.colors.chonk.red400 : theme.red300};
    text-indent: -99999em;
    position: absolute;
    right: 0;
    top: 1px;
    width: 11px;
    height: 11px;
    border-radius: 11px;
    line-height: 11px;
    box-shadow: ${isChonkTheme(theme) ? 'none' : '0 3px 3px #2f2936'};
  `;
};

const SidebarItemBadge = styled('span')<{collapsed: boolean | undefined}>`
  color: ${p => p.theme.white};
  background: ${p =>
    isChonkTheme(p.theme) ? p.theme.colors.chonk.red400 : p.theme.red300};
  display: block;
  text-align: center;
  font-size: 12px;
  width: 22px;
  height: 22px;
  border-radius: 22px;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
  ${getCollapsedBadgeStyle};
`;

const CollapsedFeatureBadge = styled(FeatureBadge)`
  position: absolute;
  top: 2px;
  right: 2px;
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  height: 72px;
  width: 70px;
`;
