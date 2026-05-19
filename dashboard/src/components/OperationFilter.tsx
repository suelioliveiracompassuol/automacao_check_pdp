
import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Report {
  runId: string;
  startTime: string;
}

interface OperationFilterProps {
  reports: Report[];
  selectedRunId: string | null;
  onSelectOperation: (runId: string) => void;
}

const OperationFilter: React.FC<OperationFilterProps> = ({
  reports,
  selectedRunId,
  onSelectOperation,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newRunId = event.target.value;
    if (newRunId !== selectedRunId) {
      onSelectOperation(newRunId);
    }
  };

  return (
    <div>
      <label htmlFor="operation-select" className="block text-sm font-medium text-gray-700">
        Selecione a Operação
      </label>
      <select
        id="operation-select"
        name="operation"
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        value={selectedRunId || ''}
        onChange={handleChange}
      >
        {reports.map((report) => (
          <option key={report.runId} value={report.runId}>
            {format(new Date(report.startTime), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
          </option>
        ))}
      </select>
    </div>
  );
};

export default OperationFilter;
