import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { Team, TeamDocument } from '../../teams/schemas/team.schema';
import { TeamStats, TeamStatsDocument } from '../../stats/schemas/team-stats.schema';
import { Types } from 'mongoose'; // Import Types for ObjectId

interface TeamData {
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  teamLogoUrl: string;
}

interface TeamStatsData {
  name: string;
  pace?: number;
  offensiveRating: number;
  defensiveRating: number;
  threePointPercentage: number;
  fieldGoalPercentage?: number;
  wins?: number;
  losses?: number;
  gamesPlayed?: number;
  pointsPerGame?: number;
  reboundsPerGame?: number;
  assistsPerGame?: number;
  stealsPerGame?: number;
  blocksPerGame?: number;
  turnoversPerGame?: number;
  additionalStats?: Record<string, number>;
}

interface PlayoffTeam {
  id: string;
  name: string;
  conference: string;
  weightedRating: number;
  wins?: number;
  losses?: number;
}

interface SeriesResult {
  winner: string;
  seriesScore: string;
  games: string[];
}

@Injectable()
export class EspnDataService {
  private readonly logger = new Logger(EspnDataService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    @InjectModel(TeamStats.name) private teamStatsModel: Model<TeamStatsDocument>,
  ) {}

  // Public method to find a team by name
  async findTeamByName(name: string): Promise<TeamDocument | null> {
    return this.teamModel.findOne({ name }).exec();
  }

  @Cron('0 4 * * *')
  async handleDailyDataUpdate(): Promise<void> {
    this.logger.log('Starting daily NBA data update');
    const season = this.getCurrentSeason();

    try {
      await this.updateTeams();
      await this.updateTeamStats(season);
      this.logger.log('Daily NBA data update completed successfully');
    } catch (error) {
      this.logger.error(`Error in daily update: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateTeams(): Promise<TeamData[]> {
    const teamsUrl = 'https://www.espn.com/nba/teams';

    try {
      const { data } = await firstValueFrom(this.httpService.get(teamsUrl));
      const $ = cheerio.load(data);
      const teams: TeamData[] = [];

      $('.ContentList__Item').each((i, element) => {
        const teamElement = $(element);
        const name = teamElement.find('h2').text().trim();
        const linkElement = teamElement.find('a');
        const link = linkElement.attr('href') || '';

        const urlParts = link.split('/');
        const abbreviation = urlParts[urlParts.length - 2]?.toUpperCase() || '';

        let conference = 'Unknown';
        let division = 'Unknown';

        const headingText = teamElement.prevAll('div.headline').first().text();
        if (headingText.includes('Atlantic')) {
          conference = 'Eastern'; division = 'Atlantic';
        } else if (headingText.includes('Central')) {
          conference = 'Eastern'; division = 'Central';
        } else if (headingText.includes('Southeast')) {
          conference = 'Eastern'; division = 'Southeast';
        } else if (headingText.includes('Northwest')) {
          conference = 'Western'; division = 'Northwest';
        } else if (headingText.includes('Pacific')) {
          conference = 'Western'; division = 'Pacific';
        } else if (headingText.includes('Southwest')) {
          conference = 'Western'; division = 'Southwest';
        }

        if (name && abbreviation) {
          teams.push({
            name, abbreviation, conference, division,
            teamLogoUrl: `https://a.espncdn.com/i/teamlogos/nba/500/${abbreviation.toLowerCase()}.png`,
          });
        }
      });

      for (const team of teams) {
        await this.teamModel.findOneAndUpdate(
          { name: team.name },
          { ...team, abbreviation: team.abbreviation },
          { upsert: true, new: true },
        );
      }

      this.logger.log(`Updated ${teams.length} NBA teams`);
      return teams;
    } catch (error) {
      this.logger.error(`Error fetching teams: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateTeamStats(season: string): Promise<void> {
    try {
      const teamsData = await this.fetchTeamStatsData();
      const teams = await this.teamModel.find().exec();
      const today = new Date();

      for (const team of teams) {
        const teamData = teamsData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(team.name));
        if (teamData) {
          const teamStats = new this.teamStatsModel({
            date: today,
            teamId: team._id as Types.ObjectId, // Explicit cast to Types.ObjectId
            season,
            offensiveRating: teamData.offensiveRating,
            defensiveRating: teamData.defensiveRating,
            threePointPercentage: teamData.threePointPercentage,
            fieldGoalPercentage: teamData.fieldGoalPercentage || 0,
            reboundsPerGame: teamData.reboundsPerGame || 0,
            assistsPerGame: teamData.assistsPerGame || 0,
            turnoversPerGame: teamData.turnoversPerGame || 0,
            stealsPerGame: teamData.stealsPerGame || 0,
            blocksPerGame: teamData.blocksPerGame || 0,
            pointsPerGame: teamData.pointsPerGame || 0,
            gamesPlayed: teamData.gamesPlayed || 0,
            wins: teamData.wins || 0,
            losses: teamData.losses || 0,
            additionalStats: teamData.additionalStats || {},
            dataSource: 'ESPN',
          });
          await teamStats.save();
        }
      }

      this.logger.log(`Updated stats for ${teams.length} teams for season ${season}`);
    } catch (error) {
      this.logger.error(`Error updating team stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async fetchTeamStatsData(): Promise<TeamStatsData[]> {
    try {
      const [efficiencyData, shootingData, recordsData, generalStatsData] = await Promise.all([
        this.fetchAndParseEfficiencyData('https://www.espn.com/nba/hollinger/teamstats'),
        this.fetchAndParseShootingData('https://www.espn.com/nba/stats/team/_/table/offensive/sort/threePointPct/dir/desc'),
        this.fetchAndParseStandingsData('https://www.espn.com/nba/standings'),
        this.fetchAndParseGeneralStatsData('https://www.espn.com/nba/stats/team'),
      ]);

      return this.combineTeamData(efficiencyData, shootingData, recordsData, generalStatsData);
    } catch (error) {
      this.logger.error(`Error fetching team stats data: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async fetchAndParseEfficiencyData(url: string): Promise<TeamStatsData[]> {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
      const teams: Partial<TeamStatsData>[] = [];

      $('table.tablehead tr:not(.colhead)').each((i, element) => {
        if (i > 0) {
          const cols = $(element).find('td');
          if (cols.length >= 11) {
            const teamName = $(cols[1]).text().trim();
            const pace = parseFloat($(cols[2]).text().trim()) || 0;
            const offensiveRating = parseFloat($(cols[9]).text().trim()) || 0;
            const defensiveRating = parseFloat($(cols[10]).text().trim()) || 0;

            teams.push({ name: teamName, pace, offensiveRating, defensiveRating, threePointPercentage: 0, fieldGoalPercentage: 0 });
          }
        }
      });

      return teams as TeamStatsData[];
    } catch (error) {
      this.logger.error(`Error parsing efficiency data: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async fetchAndParseShootingData(url: string): Promise<TeamStatsData[]> {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
      const teams: Partial<TeamStatsData>[] = [];

      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
          const threePointPercentage = parseFloat($(columns[8]).text().trim()) / 100 || 0;
          const fieldGoalPercentage = parseFloat($(columns[3]).text().trim()) / 100 || 0;

          teams.push({ name: teamName, threePointPercentage, fieldGoalPercentage, offensiveRating: 0, defensiveRating: 0 });
        }
      });

      return teams as TeamStatsData[];
    } catch (error) {
      this.logger.error(`Error parsing shooting data: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async fetchAndParseStandingsData(url: string): Promise<TeamStatsData[]> {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
      const teams: Partial<TeamStatsData>[] = [];

      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
          const record = $(columns[0]).text().trim().split('-');
          const wins = parseInt(record[0], 10) || 0;
          const losses = parseInt(record[1], 10) || 0;

          teams.push({ name: teamName, wins, losses, gamesPlayed: wins + losses, offensiveRating: 0, defensiveRating: 0, threePointPercentage: 0 });
        }
      });

      return teams as TeamStatsData[];
    } catch (error) {
      this.logger.error(`Error parsing standings data: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async fetchAndParseGeneralStatsData(url: string): Promise<TeamStatsData[]> {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
      const teams: Partial<TeamStatsData>[] = [];

      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
          const pointsPerGame = parseFloat($(columns[1]).text().trim()) || 0;
          const reboundsPerGame = parseFloat($(columns[2]).text().trim()) || 0;
          const assistsPerGame = parseFloat($(columns[3]).text().trim()) || 0;
          const stealsPerGame = parseFloat($(columns[4]).text().trim()) || 0;
          const blocksPerGame = parseFloat($(columns[5]).text().trim()) || 0;
          const turnoversPerGame = parseFloat($(columns[6]).text().trim()) || 0;

          teams.push({
            name: teamName,
            pointsPerGame,
            reboundsPerGame,
            assistsPerGame,
            stealsPerGame,
            blocksPerGame,
            turnoversPerGame,
            additionalStats: { pointsPerGame, reboundsPerGame, assistsPerGame, stealsPerGame, blocksPerGame, turnoversPerGame },
            offensiveRating: 0,
            defensiveRating: 0,
            threePointPercentage: 0,
          });
        }
      });

      return teams as TeamStatsData[];
    } catch (error) {
      this.logger.error(`Error parsing general stats data: ${error.message}`, error.stack);
      throw error;
    }
  }

  private combineTeamData(
    efficiencyData: TeamStatsData[],
    shootingData: TeamStatsData[],
    recordsData: TeamStatsData[],
    generalStatsData: TeamStatsData[],
  ): TeamStatsData[] {
    const combinedData: TeamStatsData[] = [];

    for (const effTeam of efficiencyData) {
      const teamName = effTeam.name;
      const shootingTeam = shootingData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(teamName)) || { threePointPercentage: 0, fieldGoalPercentage: 0 } as Partial<TeamStatsData>;
      const recordTeam = recordsData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(teamName)) || { wins: 0, losses: 0, gamesPlayed: 0 } as Partial<TeamStatsData>;
      const generalTeam = generalStatsData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(teamName)) || {
        pointsPerGame: 0,
        reboundsPerGame: 0,
        assistsPerGame: 0,
        stealsPerGame: 0,
        blocksPerGame: 0,
        turnoversPerGame: 0,
        additionalStats: {},
      } as Partial<TeamStatsData>;

      combinedData.push({
        name: teamName,
        offensiveRating: effTeam.offensiveRating,
        defensiveRating: effTeam.defensiveRating,
        pace: effTeam.pace,
        threePointPercentage: shootingTeam.threePointPercentage || 0,
        fieldGoalPercentage: shootingTeam.fieldGoalPercentage || 0,
        wins: recordTeam.wins || 0,
        losses: recordTeam.losses || 0,
        gamesPlayed: recordTeam.gamesPlayed || 0,
        pointsPerGame: generalTeam.pointsPerGame || 0,
        reboundsPerGame: generalTeam.reboundsPerGame || 0,
        assistsPerGame: generalTeam.assistsPerGame || 0,
        stealsPerGame: generalTeam.stealsPerGame || 0,
        blocksPerGame: generalTeam.blocksPerGame || 0,
        turnoversPerGame: generalTeam.turnoversPerGame || 0,
        additionalStats: generalTeam.additionalStats || {},
      });
    }

    return combinedData;
  }

  private normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace('los angeles', 'la')
      .replace('trail blazers', 'blazers');
  }

  public getCurrentSeason(): string {
    const today = new Date('2025-03-07T08:30:00-08:00');
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return month < 10 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  }

  async fetchStandingsForYear(year: string): Promise<TeamStatsDocument[]> {
    const standingsUrl = `https://www.espn.com/nba/standings/_/season/${year}`;
    try {
      const { data } = await firstValueFrom(this.httpService.get(standingsUrl));
      const $ = cheerio.load(data);
      const teams: Partial<TeamStatsDocument>[] = [];

      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
          const record = $(columns[0]).text().trim().split('-');
          const wins = parseInt(record[0], 10) || 0;
          const losses = parseInt(record[1], 10) || 0;

          teams.push({
            date: new Date(),
            season: year,
            gamesPlayed: wins + losses,
            wins,
            losses,
            dataSource: 'ESPN',
          });
        }
      });

      return this.teamStatsModel.create(teams);
    } catch (error) {
      this.logger.error(`Error fetching standings for year ${year}: ${error.message}`, error.stack);
      throw error;
    }
  }

  calculateWeightedRating(team: any, weights: { offensive: number; defensive: number; threePoint: number }): number {
    const { offensiveRating, defensiveRating, threePointPercentage } = team;
    const offensiveWeight = weights.offensive || 0.30; // Default offensive weight if undefined
    const defensiveWeight = weights.defensive || 0.50; // Default defensive weight if undefined
    const threePointWeight = weights.threePoint || 0.20; // Default threePoint weight if undefined

    return (offensiveRating * offensiveWeight) +
           ((1 / defensiveRating) * defensiveWeight) +
           (threePointPercentage * threePointWeight);
}

  async simulateSeries(team1Id: string, team2Id: string, weights: { offensive: number; defensive: number; threePoint: number }): Promise<SeriesResult> {
    const team1 = await this.teamModel.findById(team1Id).exec();
    const team2 = await this.teamModel.findById(team2Id).exec();

    if (!team1 || !team2) {
      throw new Error('One or both teams not found');
    }

    let team1Wins = 0;
    let team2Wins = 0;
    const games: string[] = [];
    const random = Math.random;

    while (team1Wins < 4 && team2Wins < 4) {
      const luckFactor = (random() * 0.04) - 0.02;
      const gameNumber = team1Wins + team2Wins + 1;
      const team1HasHomeCourt = [1, 2, 5, 7].includes(gameNumber);
      const homeCourtAdvantage = 0.03;

      const team1Stat = await this.teamStatsModel.findOne({ teamId: team1._id as Types.ObjectId }).sort({ date: -1 }).exec();
      const team2Stat = await this.teamStatsModel.findOne({ teamId: team2._id as Types.ObjectId }).sort({ date: -1 }).exec();

      if (!team1Stat || !team2Stat) {
        throw new Error(`Stats not found for team ${team1.name} or ${team2.name}`);
      }

      const team1Rating = this.calculateWeightedRating(team1Stat, weights);
      const team2Rating = this.calculateWeightedRating(team2Stat, weights);

      const team1EffectiveRating = team1Rating + luckFactor + (team1HasHomeCourt ? homeCourtAdvantage : 0);
      const team2EffectiveRating = team2Rating + luckFactor + (team1HasHomeCourt ? 0 : homeCourtAdvantage);

      const winner = team1EffectiveRating > team2EffectiveRating ? team1 : team2;
      if (winner.name === team1.name) team1Wins++; else team2Wins++;

      games.push(`Game ${gameNumber}: ${winner.name} wins ${team1HasHomeCourt ? '(home)' : '(away)'}`);
      this.logger.log(games[games.length - 1]);
    }

    const winner = team1Wins > team2Wins ? team1.name : team2.name;
    const seriesScore = `${team1Wins}-${team2Wins}`;
    this.logger.log(`${winner} wins series ${seriesScore}`);

    return { winner, seriesScore, games };
  }

  async simulatePlayIn(playInTeams: PlayoffTeam[], weights: { offensive: number; defensive: number; threePoint: number }): Promise<PlayoffTeam[]> {
    const playoffTeams: PlayoffTeam[] = [...playInTeams];

    const conferences = ['Eastern', 'Western'];
    for (const conference of conferences) {
      const confTeams = playInTeams.filter(t => t.conference === conference).sort((a, b) => b.weightedRating - a.weightedRating);
      if (confTeams.length >= 4) {
        const [seed7, seed8, seed9, seed10] = confTeams.slice(0, 4).map(t => t.id);

        const result78 = await this.simulateSeries(seed7, seed8, weights);
        const winner78 = await this.teamModel.findOne({ name: result78.winner });
        const winner78Id = winner78?._id?.toString() || seed7;
        this.logger.log(`Play-In ${conference} 7-8: ${result78.winner} wins`);

        const result910 = await this.simulateSeries(seed9, seed10, weights);
        const winner910 = await this.teamModel.findOne({ name: result910.winner });
        const winner910Id = winner910?._id?.toString() || seed9;
        this.logger.log(`Play-In ${conference} 9-10: ${result910.winner} wins`);

        const loser78Id = winner78Id === seed7 ? seed8 : seed7;
        const resultFinal = await this.simulateSeries(loser78Id, winner910Id, weights);
        const winnerFinal = await this.teamModel.findOne({ name: resultFinal.winner });
        const winnerFinalId = winnerFinal?._id?.toString() || loser78Id;
        this.logger.log(`Play-In ${conference} Final: ${resultFinal.winner} wins for 8th seed`);

        const updatedTeams = confTeams.map(t => {
          if (t.id === seed7 || t.id === winner78Id) return { ...t, id: seed7 };
          if (t.id === winnerFinalId) return { ...t, id: winnerFinalId };
          return t;
        }).filter(t => t.id === seed7 || t.id === winnerFinalId);
        playoffTeams.splice(playoffTeams.findIndex(t => t.conference === conference && [seed7, seed8, seed9, seed10].includes(t.id)), 4, ...updatedTeams);
      }
    }

    return playoffTeams.filter(t => t.conference && ['Eastern', 'Western'].includes(t.conference));
  }

  async simulateCurrentPlayoffs(weights: { offensive: number; defensive: number; threePoint: number }): Promise<{ champion: string; rounds: Record<string, SeriesResult[]> }> {
    const latestStats = await this.teamStatsModel.find().sort({ date: -1 }).limit(30).exec();
    const teams = await this.teamModel.find().exec();

    const playoffTeams: PlayoffTeam[] = teams.map(team => {
      const stat = latestStats.find(s => s.teamId.toString() === team._id.toString());
      const weightedRating = stat ? this.calculateWeightedRating(stat, weights) : 0; // Weights are passed here and handled in calculateWeightedRating
      return {
        id: team._id.toString(),
        name: team.name,
        conference: team.conference,
        weightedRating,
        wins: stat?.wins,
        losses: stat?.losses,
      };
    }).filter(t => t.conference && t.weightedRating > 0);

    const conferences = ['Eastern', 'Western'];
    const conferenceTeams: Record<string, PlayoffTeam[]> = {};
    for (const conf of conferences) {
      conferenceTeams[conf] = playoffTeams
        .filter(t => t.conference === conf)
        .sort((a, b) => b.weightedRating - a.weightedRating)
        .slice(0, 10); // Get top 10 teams for play-in consideration
    }

    const updatedPlayoffTeams = await this.simulatePlayIn(
      [...conferenceTeams['Eastern'], ...conferenceTeams['Western']],
      weights
    ); // Call simulatePlayIn to resolve play-in tournament


    const finalPlayoffTeams: PlayoffTeam[] = [];
    for (const conf of conferences) {
      const top6 = conferenceTeams[conf].slice(0, 6).map(t => ({ ...t, id: t.id })); // Top 6 seeds are directly qualified
      const playInWinners = updatedPlayoffTeams.filter(t => t.conference === conf && !top6.some(t2 => t2.id === t.id)); // Play-in winners
      finalPlayoffTeams.push(...top6, ...playInWinners); // Combine top 6 and play-in winners for final playoff bracket
    }


    const rounds: Record<string, SeriesResult[]> = { 'First Round': [], 'Conference Semifinals': [], 'Conference Finals': [], 'NBA Finals': [] };

    for (const conference of conferences) {
      const confTeams = finalPlayoffTeams.filter(t => t.conference === conference).sort((a, b) => b.weightedRating - a.weightedRating);
      if (confTeams.length >= 8) {
        this.logger.log(`\n===== ${conference} Conference Playoffs =====`);

        this.logger.log('\n----- First Round -----');
        const round2Teams: PlayoffTeam[] = [];
        for (let i = 0; i < 4; i++) {
          const higherSeed = confTeams[i].id;
          const lowerSeed = confTeams[7 - i].id;
          this.logger.log(`\nMatchup: #${i + 1} ${confTeams[i].name} vs. #${8 - i} ${confTeams[7 - i].name}`);
          const result = await this.simulateSeries(higherSeed, lowerSeed, weights);
          rounds['First Round'].push(result);
          const winnerTeam = await this.teamModel.findOne({ name: result.winner });
          round2Teams.push({
            id: winnerTeam?._id?.toString() || higherSeed,
            name: result.winner,
            conference,
            weightedRating: confTeams.find(t => t.name === result.winner)?.weightedRating || 0,
          });
        }

        this.logger.log('\n----- Conference Semifinals -----');
        const conferenceFinalsTeams: PlayoffTeam[] = [];
        for (let i = 0; i < 2; i++) {
          const team1 = round2Teams[i].id;
          const team2 = round2Teams[3 - i].id;
          this.logger.log(`\nMatchup: ${round2Teams[i].name} vs. ${round2Teams[3 - i].name}`);
          const result = await this.simulateSeries(team1, team2, weights);
          rounds['Conference Semifinals'].push(result);
          const winnerTeam = await this.teamModel.findOne({ name: result.winner });
          conferenceFinalsTeams.push({
            id: winnerTeam?._id?.toString() || team1,
            name: result.winner,
            conference,
            weightedRating: round2Teams.find(t => t.name === result.winner)?.weightedRating || 0,
          });
        }

        this.logger.log('\n----- Conference Finals -----');
        const team1 = conferenceFinalsTeams[0].id;
        const team2 = conferenceFinalsTeams[1].id;
        this.logger.log(`\nMatchup: ${conferenceFinalsTeams[0].name} vs. ${conferenceFinalsTeams[1].name}`);
        const result = await this.simulateSeries(team1, team2, weights);
        rounds['Conference Finals'].push(result);
      }
    }

    this.logger.log('\n===== NBA Finals =====');
    const eastChampion = rounds['Conference Finals'].find(r => r.winner && this.teamModel.findOne({ name: r.winner, conference: 'Eastern' }))?.winner;
    const westChampion = rounds['Conference Finals'].find(r => r.winner && this.teamModel.findOne({ name: r.winner, conference: 'Western' }))?.winner;

    if (eastChampion && westChampion) {
      const eastTeam = await this.teamModel.findOne({ name: eastChampion });
      const westTeam = await this.teamModel.findOne({ name: westChampion });
      const eastId = eastTeam?._id?.toString() || '';
      const westId = westTeam?._id?.toString() || '';
      this.logger.log(`\nNBA Finals: ${eastChampion} vs. ${westChampion}`);
      const result = await this.simulateSeries(eastId, westId, weights);
      rounds['NBA Finals'].push(result);
      this.logger.log(`\nCONGRATULATIONS TO THE ${result.winner.toUpperCase()} - YOUR NBA CHAMPIONS!`);
      return { champion: result.winner, rounds };
    } else {
      this.logger.error('Error: Unable to determine conference champions.');
      throw new Error('Unable to determine conference champions.');
    }
  }
}