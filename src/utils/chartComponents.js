export function loadLineChart() {
  return import('chart.js').then((chart) => {
    chart.Chart.register(
      chart.CategoryScale,
      chart.LinearScale,
      chart.PointElement,
      chart.LineElement,
      chart.Title,
      chart.Tooltip,
      chart.Legend,
      chart.Filler,
      chart.LogarithmicScale
    );
    return import('react-chartjs-2').then((mod) => mod.Line);
  });
}

export function loadBarChart() {
  return import('chart.js').then((chart) => {
    chart.Chart.register(
      chart.CategoryScale,
      chart.LinearScale,
      chart.BarElement,
      chart.Title,
      chart.Tooltip,
      chart.Legend
    );
    return import('react-chartjs-2').then((mod) => mod.Bar);
  });
}
