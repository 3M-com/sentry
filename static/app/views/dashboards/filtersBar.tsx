import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ToggleOnDemand} from 'sentry/utils/performance/contexts/onDemandControl';
import {decodeList} from 'sentry/utils/queryString';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/detail';
import {useInvalidateStarredDashboards} from 'sentry/views/dashboards/hooks/useInvalidateStarredDashboards';

import ReleasesSelectControl from './releasesSelectControl';
import type {DashboardFilters, DashboardPermissions} from './types';
import {DashboardFilterKeys} from './types';

type FiltersBarProps = {
  filters: DashboardFilters;
  hasUnsavedChanges: boolean;
  isEditingDashboard: boolean;
  isPreview: boolean;
  location: Location;
  onDashboardFilterChange: (activeFilters: DashboardFilters) => void;
  dashboardCreator?: User;
  dashboardPermissions?: DashboardPermissions;
  onCancel?: () => void;
  onSave?: () => Promise<void>;
  shouldBusySaveButton?: boolean;
};

export default function FiltersBar({
  filters,
  dashboardPermissions,
  dashboardCreator,
  hasUnsavedChanges,
  isEditingDashboard,
  isPreview,
  location,
  onCancel,
  onDashboardFilterChange,
  onSave,
  shouldBusySaveButton,
}: FiltersBarProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboardPermissions,
    dashboardCreator
  );

  const invalidateStarredDashboards = useInvalidateStarredDashboards();

  const selectedReleases =
    (defined(location.query?.[DashboardFilterKeys.RELEASE])
      ? decodeList(location.query[DashboardFilterKeys.RELEASE])
      : filters?.[DashboardFilterKeys.RELEASE]) ?? [];

  return (
    <Wrapper>
      <PageFilterBar condensed>
        <ProjectPageFilter
          disabled={isEditingDashboard}
          onChange={() => {
            trackAnalytics('dashboards2.filter.change', {
              organization,
              filter_type: 'project',
            });
          }}
        />
        <EnvironmentPageFilter
          disabled={isEditingDashboard}
          onChange={() => {
            trackAnalytics('dashboards2.filter.change', {
              organization,
              filter_type: 'environment',
            });
          }}
        />
        <DatePageFilter
          disabled={isEditingDashboard}
          onChange={() => {
            trackAnalytics('dashboards2.filter.change', {
              organization,
              filter_type: 'date',
            });
          }}
        />
      </PageFilterBar>
      <Fragment>
        <FilterButtons gap="lg">
          <ReleasesProvider organization={organization} selection={selection}>
            <ReleasesSelectControl
              handleChangeFilter={activeFilters => {
                onDashboardFilterChange(activeFilters);
                trackAnalytics('dashboards2.filter.change', {
                  organization,
                  filter_type: 'release',
                });
              }}
              selectedReleases={selectedReleases}
              isDisabled={isEditingDashboard}
            />
          </ReleasesProvider>
        </FilterButtons>
        {hasUnsavedChanges && !isEditingDashboard && !isPreview && (
          <FilterButtons gap="lg">
            <Button
              title={
                !hasEditAccess && t('You do not have permission to edit this dashboard')
              }
              priority="primary"
              onClick={async () => {
                await onSave?.();
                invalidateStarredDashboards();
              }}
              disabled={!hasEditAccess}
              busy={shouldBusySaveButton}
            >
              {t('Save')}
            </Button>
            <Button data-test-id={'filter-bar-cancel'} onClick={onCancel}>
              {t('Cancel')}
            </Button>
          </FilterButtons>
        )}
      </Fragment>
      <ToggleOnDemand />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};

  & button[aria-haspopup] {
    height: 100%;
    width: 100%;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: grid;
    grid-auto-flow: row;
  }
`;

const FilterButtons = styled(ButtonBar)`
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    align-items: flex-start;
    gap: ${p => p.theme.space[p.gap!]};
  }
`;
