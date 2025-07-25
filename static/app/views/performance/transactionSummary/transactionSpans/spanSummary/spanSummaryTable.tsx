import {Fragment, useCallback, useMemo} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {ROW_HEIGHT, ROW_PADDING} from 'sentry/components/performance/waterfall/constants';
import PerformanceDuration from 'sentry/components/performanceDuration';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import EventView, {type MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/insights/common/components/tableCells/spanIdCell';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  ModuleName,
  SpanFields,
  type SpanQueryFilters,
  type SpanResponse,
} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import Tab from 'sentry/views/performance/transactionSummary/tabs';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {SpanSummaryReferrer} from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/referrers';
import {useSpanSummarySort} from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/useSpanSummarySort';

type DataRowKeys =
  | SpanFields.SPAN_ID
  | SpanFields.TIMESTAMP
  | SpanFields.SPAN_DURATION
  | SpanFields.TRANSACTION_SPAN_ID
  | SpanFields.TRACE
  | SpanFields.PROJECT;

type ColumnKeys = SpanFields.SPAN_ID | SpanFields.TIMESTAMP | SpanFields.SPAN_DURATION;

type DataRow = Pick<SpanResponse, DataRowKeys> & {'transaction.duration': number};

type Column = GridColumnHeader<ColumnKeys>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanFields.SPAN_ID,
    name: t('Span ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanFields.TIMESTAMP,
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanFields.SPAN_DURATION,
    name: t('Span Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const COLUMN_TYPE: Omit<
  Record<ColumnKeys, ColumnType>,
  'spans' | 'transactionDuration'
> = {
  span_id: 'string',
  timestamp: 'date',
  'span.duration': 'duration',
};

const LIMIT = 8;

type Props = {
  project: Project | undefined;
};

export default function SpanSummaryTable(props: Props) {
  const {project} = props;
  const organization = useOrganization();
  const {spanSlug} = useParams();
  const navigate = useNavigate();
  const [spanOp, groupId] = spanSlug!.split(':');

  const location = useLocation();
  const {transaction} = location.query;
  const spansCursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);
  const spansQuery = decodeScalar(location.query.spansQuery, '');

  const filters: SpanQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transaction as string,
  };

  const sort = useSpanSummarySort();
  const spanSearchString = new MutableSearch(spansQuery).formatString();
  const search = MutableSearch.fromQueryObject(filters);
  search.addStringMultiFilter(spanSearchString);

  const {
    data: rowData,
    pageLinks,
    isPending: isRowDataLoading,
  } = useSpans(
    {
      fields: [
        SpanFields.SPAN_ID,
        SpanFields.TRANSACTION_SPAN_ID,
        SpanFields.TIMESTAMP,
        SpanFields.SPAN_DURATION,
        SpanFields.TRACE,
        SpanFields.PROJECT,
      ],
      search,
      limit: LIMIT,
      sorts: [sort],
      cursor: spansCursor,
    },
    SpanSummaryReferrer.SPAN_SUMMARY_TABLE
  );

  const transactionIds = rowData?.map(row => row[SpanFields.TRANSACTION_SPAN_ID]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: 'Transaction Durations',
      query: MutableSearch.fromQueryObject({
        project: project?.slug,
        id: `[${transactionIds?.join() ?? ''}]`,
      }).formatString(),
      fields: ['id', 'transaction.duration'],
      version: 2,
    },
    location
  );

  const {
    isPending: isTxnDurationDataLoading,
    data: txnDurationData,
    isError: isTxnDurationError,
  } = useGenericDiscoverQuery<
    {
      data: any[];
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events',
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...eventView.getEventsAPIPayload(location),
      interval: eventView.interval,
    }),
    limit: LIMIT,
    options: {
      refetchOnWindowFocus: false,
      enabled: Boolean(rowData && rowData.length > 0),
    },
    referrer: SpanSummaryReferrer.SPAN_SUMMARY_TABLE,
  });

  // Restructure the transaction durations into a map for faster lookup
  const transactionDurationMap: Record<string, number> = {};
  txnDurationData?.data.forEach(datum => {
    transactionDurationMap[datum.id] = datum['transaction.duration'];
  });

  const mergedData: DataRow[] =
    rowData?.map((row: Pick<SpanResponse, DataRowKeys>) => {
      const transactionId = row[SpanFields.TRANSACTION_SPAN_ID];
      const newRow = {
        ...row,
        'transaction.duration': transactionDurationMap[transactionId]!,
      };
      return newRow;
    }) ?? [];

  const handleCursor: CursorHandler = (cursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: cursor},
    });
  };

  const handleSearch = useCallback(
    (searchString: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          spansQuery: new MutableSearch(searchString).formatString(),
        },
      });
    },
    [location, navigate]
  );
  const projectIds = useMemo(() => eventView.project.slice(), [eventView]);

  return (
    <Fragment>
      <StyledSearchBarWrapper>
        <SpanSearchQueryBuilder
          projects={projectIds}
          initialQuery={spansQuery}
          onSearch={handleSearch}
          searchSource="transaction_span_summary"
        />
      </StyledSearchBarWrapper>
      <VisuallyCompleteWithData
        id="SpanDetails-SpanDetailsTable"
        hasData={!!mergedData?.length}
        isLoading={isRowDataLoading}
      >
        <GridEditable
          isLoading={isRowDataLoading}
          data={mergedData}
          columnOrder={COLUMN_ORDER}
          columnSortBy={[
            {
              key: sort.field,
              order: sort.kind,
            },
          ]}
          grid={{
            renderHeadCell: column =>
              renderHeadCell({
                column,
                location,
                sort,
              }),
            // This is now caught by noUncheckedIndexedAccess, ignoring for now as
            // it seems related to some nasty grid editable generic.
            // @ts-expect-error TS(2769): No overload matches this call.
            renderBodyCell: renderBodyCell(
              location,
              organization,
              spanOp,
              isTxnDurationDataLoading || isTxnDurationError
            ),
          }}
        />
      </VisuallyCompleteWithData>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

function renderBodyCell(
  location: Location,
  organization: Organization,
  spanOp = '',
  isTxnDurationDataLoading: boolean,
  theme: Theme
) {
  return function (column: Column, dataRow: DataRow): React.ReactNode {
    const {timestamp, span_id, trace} = dataRow;
    const spanDuration = dataRow[SpanFields.SPAN_DURATION];
    const transactionId = dataRow[SpanFields.TRANSACTION_SPAN_ID];
    const transactionDuration = dataRow['transaction.duration'];

    if (column.key === SpanFields.SPAN_DURATION) {
      if (isTxnDurationDataLoading) {
        return <EmptySpanDurationBar />;
      }

      if (!transactionDuration) {
        return (
          <EmptySpanDurationBar>
            <Tooltip
              title={t('Transaction duration unknown')}
              containerDisplayMode="block"
            >
              <PerformanceDuration abbreviation milliseconds={spanDuration} />
            </Tooltip>
          </EmptySpanDurationBar>
        );
      }

      return (
        <SpanDurationBar
          spanOp={spanOp}
          spanDuration={spanDuration}
          transactionDuration={transactionDuration}
        />
      );
    }

    if (column.key === SpanFields.SPAN_ID) {
      if (!defined(span_id)) {
        return null;
      }

      return (
        <SpanIdCell
          moduleName={ModuleName.OTHER}
          spanId={span_id}
          timestamp={timestamp}
          traceId={trace}
          transactionId={transactionId}
          location={{
            ...location,
            query: {
              ...location.query,
              tab: Tab.SPANS,
              spanSlug: `${spanOp}:${transactionId}`,
            },
          }}
          source={TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY}
        />
      );
    }

    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE);
    const rendered = fieldRenderer(dataRow, {location, organization, theme});

    return rendered;
  };
}

const EmptySpanDurationBar = styled('div')`
  height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  top: ${space(0.5)};
  background-color: ${p => p.theme.gray100};
  padding-left: ${space(1)};

  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
  font-variant-numeric: tabular-nums;
  line-height: 1;
`;

const StyledSearchBarWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;
