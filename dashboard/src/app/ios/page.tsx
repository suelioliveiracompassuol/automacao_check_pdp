import { FaApple } from 'react-icons/fa6';

export default function IosPage() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <div className="flex justify-center text-5xl mb-4">
        <FaApple className="text-5xl mb-4" />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Monitoramento iOS ainda não disponível</h1>
      <p className="text-gray-500 text-sm mt-2">
        O orquestrador iOS está planejado como próxima fase do roadmap (após Android). Assim que o
        primeiro relatório for gerado, esta página passa a mostrar os resultados automaticamente —
        mesmo padrão de <code className="bg-gray-100 px-1.5 py-0.5 rounded">/android</code>.
      </p>
    </div>
  );
}
