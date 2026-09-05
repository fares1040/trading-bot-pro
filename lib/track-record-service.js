// Track Record Service - Manages historical performance of Hunter AI opportunities
// Records opportunities with timestamps, symbols, type/strategy, score, entry, stop, targets,
// direction and expected timeframe when actually available.
// Tracks outcome only from reliable observable data: OPEN / WIN / LOSS / BE / EXPIRED / INVALID
// Calculates Win Rate, Profit Factor, average return and trade count
// Allows performance breakdown by Penny / Early Explosion / Swing / Options / Institutional

class TrackRecordService {
  constructor() {
    // Use localStorage for persistence (consistent with existing analytics pattern)
    this.storageKey = 'hunter_track_record';
    this.initialize();
  }

  initialize() {
    this.load();
  }

  // Load track record from localStorage
  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.records = JSON.parse(data);
      } else {
        this.records = [];
      }
    } catch (error) {
      console.error('Failed to load track record from localStorage:', error);
      this.records = [];
    }
  }

  // Save track record to localStorage
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.records));
    } catch (error) {
      console.error('Failed to save track record to localStorage:', error);
    }
  }

  // Record a new opportunity with its outcome
  recordOpportunity({
    symbol,
    type,
    score,
    entryPrice,
    stopPrice,
    targetPrice,
    direction, // BUY, SELL, HOLD
    expectedTimeframe,
    outcome, // OPEN, WIN, LOSS, BE, EXPIRED, INVALID
    timestamp
  }) {
    const newRecord = {
      id: this.generateId(),
      symbol,
      type,
      score,
      entryPrice,
      stopPrice,
      targetPrice,
      direction,
      expectedTimeframe,
      outcome,
      timestamp
    };

    this.records.push(newRecord);
    this.save();
    return newRecord;
  }

  // Get all track records
  getAllRecords() {
    return [...this.records];
  }

  // Get records filtered by outcome
  getRecordsByOutcome(outcome) {
    return this.records.filter(r => r.outcome === outcome);
  }

  // Get records filtered by category
  getRecordsByCategory(category) {
    return this.records.filter(r => r.type === category);
  }

  // Calculate performance metrics
  calculateMetrics() {
    const totalTrades = this.records.length;
    const wins = this.getRecordsByOutcome('WIN').length;
    const losses = this.getRecordsByOutcome('LOSS').length;
    const opens = this.getRecordsByOutcome('OPEN').length;
    const beTrades = this.getRecordsByOutcome('BE').length;

    // Win Rate
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Profit Factor (average profit / average loss)
    const profits = this.records
      .filter(r => r.outcome === 'WIN')
      .map(r => r.score - r.entryPrice) // simplified profit calculation
      .filter(p => p > 0);

    const lossesSum = this.records
      .filter(r => r.outcome === 'LOSS')
      .map(r => -(r.score - r.entryPrice)) // negative profit for losses
      .filter(p => p < 0)
      .reduce((sum, p) => sum + p, 0);

    const profitFactor = lossesSum > 0
      ? profits.reduce((sum, p) => sum + p, 0) / lossesSum
      : 0;

    // Average return (percentage)
    const avgReturn = totalTrades > 0
      ? ((wins * 100) - (losses * 100)) / totalTrades
      : 0;

    // Trade count by category
    const byCategory = {
      pennies: this.getRecordsByCategory('PENNY'),
      early_explosion: this.getRecordsByCategory('EARLY_EXPLOSION'),
      swing: this.getRecordsByCategory('SWING'),
      options: this.getRecordsByCategory('OPTIONS'),
      institutional: this.getRecordsByCategory('INSTITUTIONAL')
    };

    return {
      totalTrades,
      wins,
      losses,
      opens,
      beTrades,
      winRate: Math.round(winRate * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgReturn: Math.round(avgReturn * 100) / 100,
      byCategory
    };
  }

  // Generate unique ID for records
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
}

// Export singleton instance
const trackRecordService = new TrackRecordService();
export default trackRecordService;