import {createContext, useContext, useState} from 'react';

<<<<<<< HEAD:static/app/views/performance/contexts/operationBreakdownFilter.tsx
// Make sure to update other instances like trends column fields, discover field types.
export enum SpanOperationBreakdownFilter {
  None = 'none',
  Http = 'http',
  Db = 'db',
  Browser = 'browser',
  Resource = 'resource',
}
=======
import {SpanOperationBreakdownFilter} from 'app/views/performance/transactionSummary/filter';
>>>>>>> origin/master:static/app/utils/performance/contexts/operationBreakdownFilter.tsx

const OpBreakdownFilterContext = createContext<{
  opBreakdownFilter: SpanOperationBreakdownFilter;
  setOpBreakdownFilter: (filter: SpanOperationBreakdownFilter) => void;
}>({
  opBreakdownFilter: SpanOperationBreakdownFilter.None,
  setOpBreakdownFilter: (_: SpanOperationBreakdownFilter) => {},
});

export const OpBreakdownFilterProvider = ({
  initialFilter,
  children,
}: {
  initialFilter?: SpanOperationBreakdownFilter;
  children: React.ReactNode;
}) => {
  const [opBreakdownFilter, setOpBreakdownFilter] = useState(
    initialFilter ?? SpanOperationBreakdownFilter.None
  );

  return (
    <OpBreakdownFilterContext.Provider
      value={{
        opBreakdownFilter: opBreakdownFilter ?? SpanOperationBreakdownFilter.None,
        setOpBreakdownFilter,
      }}
    >
      {children}
    </OpBreakdownFilterContext.Provider>
  );
};

export const useOpBreakdownFilter = () => useContext(OpBreakdownFilterContext);
