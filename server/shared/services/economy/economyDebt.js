// server/shared/services/economy/EconomyDebt.js
// Métodos auxiliares para gerenciamento de dívida pública
// Extraídos do economyService para reduzir complexidade

import { calculateRiskPremium } from '../../utils/economicUtils.js';
import { issueEmergencyBonds } from '../../utils/economicCalculations.js';
import { ECONOMIC_CONSTANTS } from '../../utils/economicConstants.js';

/**
 * Classe auxiliar para gerenciamento de dívida pública
 * Contém todos os métodos relacionados a títulos e contratos de dívida
 */
export class EconomyDebt {
  constructor(economyService) {
    this.economyService = economyService;
    this.nextDebtId = 1;
  }

  /**
   * Emite títulos de dívida pública
   */
  issueDebtBonds(roomName, countryName, bondAmount) {
    const countryState = this.economyService.getCountryState(roomName, countryName);

    if (!countryState) {
      return { success: false, message: 'País não encontrado' };
    }

    const economy = countryState.economy;
    const debtToGdpRatio = economy.publicDebt / economy.gdp;
    
    if (bondAmount <= 0 || bondAmount > 1000) {
      return { success: false, message: 'Valor deve estar entre 0 e 1000 bilhões' };
    }
    
    const newDebtToGdp = (economy.publicDebt + bondAmount) / economy.gdp;
    if (newDebtToGdp > ECONOMIC_CONSTANTS.MAX_DEBT_TO_GDP_RATIO) {
      return { success: false, message: 'Emissão faria a dívida ultrapassar 120% do PIB' };
    }

    // DELEGADO: Calcular taxa de juros com função de economicUtils
    const riskPremium = calculateRiskPremium(economy.creditRating, debtToGdpRatio);
    const effectiveRate = economy.interestRate + riskPremium;
    
    // Criar contrato expandido
    const monthlyRate = effectiveRate / 100 / 12;
    const totalDebtWithInterest = bondAmount * Math.pow(1 + monthlyRate, 120);

    const contract = {
      id: this.nextDebtId++,
      originalValue: bondAmount,
      remainingValue: totalDebtWithInterest, // ← CORREÇÃO: Valor total com juros compostos
      interestRate: effectiveRate,
      baseRate: economy.interestRate,
      riskPremium: riskPremium,
      monthlyPayment: this.calculateMonthlyPayment(bondAmount, effectiveRate, 120),
      remainingInstallments: 120,
      issueDate: new Date(),
      emergencyBond: false
    };
    
    // Armazenar contrato
    const countryKey = `${countryName}:${roomName}`;
    const contracts = this.economyService.debtContracts.get(countryKey) || [];
    contracts.push(contract);
    this.economyService.debtContracts.set(countryKey, contracts);
    
    // Atualizar economia
    economy.treasury += bondAmount;
    economy.publicDebt += bondAmount;
    
    this.economyService.setCountryState(roomName, countryName, countryState);
    
    return {
      success: true,
      message: `Títulos emitidos com taxa: ${effectiveRate.toFixed(2)}%`,
      bondAmount,
      newTreasury: economy.treasury,
      newPublicDebt: economy.publicDebt,
      newContract: contract,
      effectiveRate
    };
  }

  /**
   * Cria contratos de dívida inicial para países
   */
  createInitialDebtContracts(countryName, countryState, totalDebt) {
    const roomName = 'initial';
    const economy = countryState.economy;
    const contracts = [];
    
    // Dividir dívida em 4 títulos
    const debtDistribution = [0.4, 0.3, 0.2, 0.1];
    const ageMonths = [24, 12, 6, 0]; // Idades dos títulos em meses
    
    debtDistribution.forEach((percentage, index) => {
      const bondValue = totalDebt * percentage;
      const age = ageMonths[index];
      const rateAdjustment = index === 0 ? -1 : index === 3 ? 1.5 : 0;
      
      const baseRate = ECONOMIC_CONSTANTS.EQUILIBRIUM_INTEREST_RATE + rateAdjustment;
      const monthlyPayment = this.calculateMonthlyPayment(bondValue, baseRate, 120);
      
      const contract = {
        id: this.nextDebtId++,
        originalValue: bondValue,
        remainingValue: bondValue * (1 - (age / 120)), // Valor diminuído pela idade
        interestRate: baseRate,
        baseRate: baseRate,
        riskPremium: 0,
        monthlyPayment: monthlyPayment,
        remainingInstallments: 120 - age,
        issueDate: new Date(Date.now() - (age * 30 * 24 * 60 * 60 * 1000)),
        emergencyBond: false
      };
      
      contracts.push(contract);
    });
    
    // Armazenar contratos
    const countryKey = `${countryName}:initial`;
    this.economyService.debtContracts.set(countryKey, contracts);
    
    return contracts;
  }

  /**
   * Cria contrato de dívida emergencial
   */
  createEmergencyDebtContract(roomName, countryName, amount, rate) {
    const contract = {
      id: this.nextDebtId++,
      originalValue: amount,
      remainingValue: amount * Math.pow(1 + rate / 100 / 12, 120),
      interestRate: rate,
      baseRate: rate * 0.6, // Taxa base menor para emergência
      riskPremium: rate * 0.4,
      monthlyPayment: this.calculateMonthlyPayment(amount, rate, 120),
      remainingInstallments: 120,
      issueDate: new Date(),
      emergencyBond: true
    };
    
    const countryKey = `${countryName}:${roomName}`;
    const contracts = this.economyService.debtContracts.get(countryKey) || [];
    contracts.push(contract);
    this.economyService.debtContracts.set(countryKey, contracts);
    
    return contract;
  }

  /**
   * Calcula pagamento mensal de um título
   */
  calculateMonthlyPayment(principal, annualRate, months) {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    
    const denominator = 1 - Math.pow(1 + monthlyRate, -months);
    return (principal * monthlyRate) / denominator;
  }

  /**
   * Notifica sobre atualizações nos contratos de dívida
   */
  notifyDebtContractsUpdated(roomName, countryName, data) {
    if (global.io) {
      // Usar broadcast para a sala - método mais simples
      global.io.to(roomName).emit('debtContractsUpdated', {
        country: countryName,
        ...data
      });
    }
  }

  /**
   * Notifica sobre emissão de títulos de emergência
   */
  notifyEmergencyBondIssued(roomName, countryName, bondInfo) {
    if (global.io) {
      // Usar broadcast para a sala - método mais simples
      global.io.to(roomName).emit('emergencyBondIssued', {
        country: countryName,
        amount: bondInfo.amount,
        rate: bondInfo.rate,
        rating: bondInfo.rating,
        timestamp: bondInfo.timestamp
      });
    }
  }
}