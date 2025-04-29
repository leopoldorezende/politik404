import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../../assets/styles/EconomyChart.css';

const EconomyChart = ({ countryName }) => {
  // Estado para armazenar dados processados para o gráfico
  const [chartData, setChartData] = useState([]);
  // Estado para selecionar o indicador econômico a exibir
  const [selectedIndicator, setSelectedIndicator] = useState('gdp');

  // Selecionar dados econômicos do Redux
  const economyUpdates = useSelector(state => state.game.economyUpdates);
  const countriesData = useSelector(state => state.game.countriesData);
  const selectedCountry = useSelector(state => state.game.selectedCountry);

  // Usar o país selecionado se countryName não for especificado
  const country = countryName || selectedCountry;

  // Processar atualizações econômicas para gráfico
  useEffect(() => {
    if (!country || !economyUpdates || Object.keys(economyUpdates).length === 0) {
      setChartData([]);
      return;
    }

    // Encontrar a sala atual (usando a primeira disponível nas atualizações)
    const currentRoom = Object.keys(economyUpdates)[0];
    if (!currentRoom || !economyUpdates[currentRoom]) {
      return;
    }

    // Coletar todos os dados para o país selecionado
    const countryData = [];
    
    // Processar cada atualização
    economyUpdates[currentRoom].forEach((update, index) => {
      // Se a atualização contém dados para este país
      if (update.countries && update.countries[country]) {
        const countryUpdate = update.countries[country];
        
        // Criar objeto de dados para o gráfico
        const dataPoint = {
          index,
          time: new Date(update.timestamp).toLocaleTimeString(),
          timestamp: update.timestamp,
        };
        
        // Adicionar dados do indicador específico
        if (selectedIndicator === 'gdp' && countryUpdate.gdp) {
          dataPoint.value = countryUpdate.gdp.value;
          dataPoint.label = 'PIB';
          dataPoint.unit = countryUpdate.gdp.unit || '';
        } else if (selectedIndicator === 'treasury' && countryUpdate.treasury) {
          dataPoint.value = countryUpdate.treasury.value;
          dataPoint.label = 'Tesouro';
          dataPoint.unit = countryUpdate.treasury.unit || '';
        } else {
          // Para indicadores simples como inflação, desemprego, etc.
          dataPoint.value = countryUpdate[selectedIndicator] || 0;
          
          // Definir rótulo apropriado
          switch (selectedIndicator) {
            case 'gdpGrowth':
              dataPoint.label = 'Crescimento do PIB';
              dataPoint.unit = '%';
              break;
            case 'inflation':
              dataPoint.label = 'Inflação';
              dataPoint.unit = '%';
              break;
            case 'unemployment':
              dataPoint.label = 'Desemprego';
              dataPoint.unit = '%';
              break;
            case 'popularity':
              dataPoint.label = 'Popularidade';
              dataPoint.unit = '%';
              break;
            default:
              dataPoint.label = selectedIndicator;
              dataPoint.unit = '';
          }
        }
        
        // Adicionar ao array de dados
        countryData.push(dataPoint);
      }
    });
    
    // Ordenar por timestamp
    countryData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Definir os dados do gráfico
    setChartData(countryData);
  }, [country, economyUpdates, selectedIndicator]);

  // Obter valor atual do indicador selecionado
  const getCurrentValue = () => {
    if (!country || !countriesData || !countriesData[country] || !countriesData[country].economy) {
      return 'N/A';
    }
    
    const economy = countriesData[country].economy;
    
    switch (selectedIndicator) {
      case 'gdp':
        return economy.gdp ? `${economy.gdp.value} ${economy.gdp.unit || ''}` : 'N/A';
      case 'treasury':
        return economy.treasury ? `${economy.treasury.value} ${economy.treasury.unit || ''}` : 'N/A';
      case 'gdpGrowth':
      case 'inflation':
      case 'unemployment':
      case 'popularity':
        return `${economy[selectedIndicator] || 0}%`;
      default:
        return economy[selectedIndicator] || 'N/A';
    }
  };

  // Renderiza um CustomTooltip para o gráfico
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="economy-chart-tooltip">
          <p className="time">{label}</p>
          <p className="value">
            {`${payload[0].payload.label}: ${payload[0].value} ${payload[0].payload.unit}`}
          </p>
        </div>
      );
    }
    
    return null;
  };

  // Obter a cor apropriada para o indicador
  const getLineColor = () => {
    switch (selectedIndicator) {
      case 'gdp':
      case 'gdpGrowth':
      case 'treasury':
        return '#4caf50'; // Verde para indicadores positivos
      case 'inflation':
      case 'unemployment':
        return '#f44336'; // Vermelho para indicadores negativos
      case 'popularity':
        return '#2196f3'; // Azul para popularidade
      default:
        return '#9c27b0'; // Roxo para outros
    }
  };

  return (
    <div className="economy-chart-container">
      <div className="chart-header">
        <h3>Evolução Econômica: {country || 'Nenhum país selecionado'}</h3>
        <div className="chart-controls">
          <select 
            value={selectedIndicator} 
            onChange={(e) => setSelectedIndicator(e.target.value)}
            className="indicator-select"
          >
            <option value="gdp">PIB</option>
            <option value="gdpGrowth">Crescimento do PIB</option>
            <option value="treasury">Tesouro</option>
            <option value="inflation">Inflação</option>
            <option value="unemployment">Desemprego</option>
            <option value="popularity">Popularidade</option>
          </select>
          <div className="current-value">
            Valor Atual: <strong>{getCurrentValue()}</strong>
          </div>
        </div>
      </div>
      
      {chartData.length > 0 ? (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                name={chartData[0]?.label || selectedIndicator}
                stroke={getLineColor()}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="no-data-message">
          <p>Sem dados disponíveis. Aguarde atualizações econômicas.</p>
        </div>
      )}
    </div>
  );
};

export default EconomyChart;