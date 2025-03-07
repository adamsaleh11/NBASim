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

interface TeamData {
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  teamLogoUrl: string;
}

@Injectable()
export class EspnDataService {
  private readonly logger = new Logger(EspnDataService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    @InjectModel(TeamStats.name) private teamStatsModel: Model<TeamStatsDocument>
  ) {}

  // Fetch data daily at 4 AM
  @Cron('0 4 * * *')
  async handleDailyDataUpdate() {
    this.logger.log('Starting daily NBA data update');
    const season = this.getCurrentSeason();
    
    try {
      await this.updateTeams();
      await this.updateTeamStats(season);
      this.logger.log('Daily NBA data update completed successfully');
    } catch (error) {
      this.logger.error(`Error in daily update: ${error.message}`);
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
        
        // Extract team abbreviation from link
        const urlParts = link.split('/');
        const abbreviation = urlParts[urlParts.length - 2]?.toUpperCase() || '';
        
        // Determine conference and division
        let conference = 'Unknown';
        let division = 'Unknown';
        
        const headingText = teamElement.prevAll('div.headline').first().text();
        if (headingText.includes('Atlantic')) {
          conference = 'Eastern';
          division = 'Atlantic';
        } else if (headingText.includes('Central')) {
          conference = 'Eastern';
          division = 'Central';
        } else if (headingText.includes('Southeast')) {
          conference = 'Eastern';
          division = 'Southeast';
        } else if (headingText.includes('Northwest')) {
          conference = 'Western';
          division = 'Northwest';
        } else if (headingText.includes('Pacific')) {
          conference = 'Western';
          division = 'Pacific';
        } else if (headingText.includes('Southwest')) {
          conference = 'Western';
          division = 'Southwest';
        }
        
        if (name && abbreviation) {
          teams.push({
            name,
            abbreviation,
            conference,
            division,
            teamLogoUrl: `https://a.espncdn.com/i/teamlogos/nba/500/${abbreviation.toLowerCase()}.png`,
          });
        }
      });
      
      // Update database with teams
      for (const team of teams) {
        await this.teamModel.findOneAndUpdate(
          { name: team.name },
          { ...team },
          { upsert: true, new: true }
        );
      }
      
      this.logger.log(`Updated ${teams.length} NBA teams`);
      return teams.map(team => ({
        name: team.name,
        abbreviation: team.abbreviation,
        conference: team.conference,
        division: team.division,
        teamLogoUrl: team.teamLogoUrl,
      }));
    } catch (error) {
      this.logger.error(`Error fetching teams: ${error.message}`);
      throw error;
    }
  }

  async updateTeamStats(season: string) {
    try {
      const teamsData = await this.fetchTeamStatsData();
      const teams = await this.teamModel.find().exec();
      const today = new Date();
      
      for (const team of teams) {
        const teamData: any = teamsData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(team.name));
        
        if (teamData) {
          const teamStats = {
            date: today,
            teamId: team._id,
            season,
            offensiveRating: teamData.offensiveRating,
            defensiveRating: teamData.defensiveRating,
            threePointPercentage: teamData.threePointPercentage,
            fieldGoalPercentage: teamData.fieldGoalPercentage,
            reboundsPerGame: teamData.reboundsPerGame,
            assistsPerGame: teamData.assistsPerGame,
            turnoversPerGame: teamData.turnoversPerGame,
            stealsPerGame: teamData.stealsPerGame,
            blocksPerGame: teamData.blocksPerGame,
            pointsPerGame: teamData.pointsPerGame,
            gamesPlayed: teamData.gamesPlayed,
            wins: teamData.wins,
            losses: teamData.losses,
            additionalStats: teamData.additionalStats || {},
            dataSource: 'ESPN',
          };
          
          await this.teamStatsModel.create(teamStats);
        }
      }
      
      this.logger.log(`Updated stats for ${teams.length} teams for season ${season}`);
    } catch (error) {
      this.logger.error(`Error updating team stats: ${error.message}`);
      throw error;
    }
  }

  private async fetchTeamStatsData() {
    try {
      // Fetch offensive and defensive ratings
      const efficiencyUrl = 'https://www.espn.com/nba/hollinger/teamstats';
      const efficiencyData = await this.fetchAndParseEfficiencyData(efficiencyUrl);
      
      // Fetch three-point and field goal percentages
      const shootingUrl = 'https://www.espn.com/nba/stats/team/_/table/offensive/sort/threePointPct/dir/desc';
      const shootingData = await this.fetchAndParseShootingData(shootingUrl);
      
      // Fetch team records
      const standingsUrl = 'https://www.espn.com/nba/standings';
      const recordsData = await this.fetchAndParseStandingsData(standingsUrl);
      
      // Fetch additional stats like rebounds, assists, etc.
      const generalStatsUrl = 'https://www.espn.com/nba/stats/team';
      const generalStatsData = await this.fetchAndParseGeneralStatsData(generalStatsUrl);
      
      // Combine all data
      const combinedData = this.combineTeamData(
        efficiencyData, 
        shootingData, 
        recordsData, 
        generalStatsData
      );
      
      return combinedData;
    } catch (error) {
      this.logger.error(`Error fetching team stats data: ${error.message}`);
      throw error;
    }
  }

  private async fetchAndParseEfficiencyData(url: string) {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
      
      const teams: { name: string; pace: number; offensiveRating: number; defensiveRating: number; }[] = [];
      
      // Find the table rows containing team data
      $('table.tablehead tr:not(.colhead)').each((i, element) => {
        if (i > 0) { // Skip header row
          const cols = $(element).find('td');
          
          if (cols.length >= 11) {
            const teamName = $(cols[1]).text().trim();
            const pace = parseFloat($(cols[2]).text().trim());
            const offensiveRating = parseFloat($(cols[9]).text().trim());
            const defensiveRating = parseFloat($(cols[10]).text().trim());
            
            teams.push({
              name: teamName,
              pace: pace,
              offensiveRating: offensiveRating,
              defensiveRating: defensiveRating,
            });
          }
        }
      });
      
      return teams;
    } catch (error) {
      this.logger.error(`Error parsing efficiency data: ${error.message}`);
      throw error;
    }
  }

  private async fetchAndParseShootingData(url: string) {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
      
      const teams: { name: string; threePointPercentage: number; fieldGoalPercentage: number; }[] = [];
      
      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
          
          // Extract three-point percentage and other shooting stats
          // Column indexes may vary; adjust as needed
          const threePointPercentage = parseFloat($(columns[8]).text().trim()) / 100;
          const fieldGoalPercentage = parseFloat($(columns[3]).text().trim()) / 100;
          
          teams.push({
            name: teamName,
            threePointPercentage: threePointPercentage,
            fieldGoalPercentage: fieldGoalPercentage,
          });
        }
      });
      
      return teams;
    } catch (error) {
      console.error('Error fetching and parsing shooting data:', error);
      throw error;
    }
  }

private async fetchAndParseStandingsData(url: string) {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
  
      const teams: { name: string; conference: string; wins: number; losses: number; gamesPlayed: number; }[] = [];
  
      // Parse standings table
      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
  
          // Extract wins, losses, and conference
          const record = $(columns[0]).text().trim().split('-');
          const wins = parseInt(record[0], 10);
          const losses = parseInt(record[1], 10);
  
          // Determine conference (Eastern or Western)
          const conference = $(element).closest('table').prev('h2').text().includes('Eastern') ? 'Eastern' : 'Western';
  
          teams.push({
            name: teamName,
            conference: conference,
            wins: wins,
            losses: losses,
            gamesPlayed: wins + losses,
          });
        }
      });
  
      return teams;
    } catch (error) {
      this.logger.error(`Error parsing standings data: ${error.message}`);
      throw error;
    }
  }

  private async fetchAndParseGeneralStatsData(url: string) {
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(data);
      
      const teams: { name: string; pointsPerGame: number; reboundsPerGame: number; assistsPerGame: number; stealsPerGame: number; blocksPerGame: number; turnoversPerGame: number; additionalStats: { pointsPerGame: number; reboundsPerGame: number; assistsPerGame: number; stealsPerGame: number; blocksPerGame: number; turnoversPerGame: number; } }[] = [];
      
      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
          
          // Extract various stats
          // Adjust column indexes based on actual structure
          const pointsPerGame = parseFloat($(columns[1]).text().trim());
          const reboundsPerGame = parseFloat($(columns[2]).text().trim());
          const assistsPerGame = parseFloat($(columns[3]).text().trim());
          const stealsPerGame = parseFloat($(columns[4]).text().trim());
          const blocksPerGame = parseFloat($(columns[5]).text().trim());
          const turnoversPerGame = parseFloat($(columns[6]).text().trim());
          
          teams.push({
            name: teamName,
            pointsPerGame,
            reboundsPerGame,
            assistsPerGame,
            stealsPerGame,
            blocksPerGame,
            turnoversPerGame,
            additionalStats: {
              pointsPerGame,
              reboundsPerGame,
              assistsPerGame,
              stealsPerGame,
              blocksPerGame,
              turnoversPerGame,
            }
          });
        }
      });
      
      return teams;
    } catch (error) {
      this.logger.error(`Error parsing general stats data: ${error.message}`);
      throw error;
    }
  }

  private combineTeamData(efficiencyData: any[], shootingData: any[], recordsData: any[], generalStatsData: any[]): any[] {
      const combinedData: any[] = [];
    
    for (const effTeam of efficiencyData) {
      const teamName = effTeam.name;
      const shootingTeam = shootingData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(teamName));
      const recordTeam = recordsData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(teamName));
      const generalTeam = generalStatsData.find(t => this.normalizeTeamName(t.name) === this.normalizeTeamName(teamName));
      
      combinedData.push({
        name: teamName,
        offensiveRating: effTeam.offensiveRating,
        defensiveRating: effTeam.defensiveRating,
        pace: effTeam.pace,
        threePointPercentage: shootingTeam?.threePointPercentage || 0,
        fieldGoalPercentage: shootingTeam?.fieldGoalPercentage || 0,
        wins: recordTeam?.wins || 0,
        losses: recordTeam?.losses || 0,
        gamesPlayed: recordTeam?.gamesPlayed || 0,
        pointsPerGame: generalTeam?.pointsPerGame || 0,
        reboundsPerGame: generalTeam?.reboundsPerGame || 0,
        assistsPerGame: generalTeam?.assistsPerGame || 0,
        stealsPerGame: generalTeam?.stealsPerGame || 0,
        blocksPerGame: generalTeam?.blocksPerGame || 0,
        turnoversPerGame: generalTeam?.turnoversPerGame || 0,
        additionalStats: generalTeam?.additionalStats || {},
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

  private getCurrentSeason(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // If we're before October, we're in the previous season
    // NBA seasons typically run from October to June
    // So the 2023-2024 season starts in October 2023
    if (month < 9) { // Before October (0-indexed months)
      return `${year-1}-${year}`;
    } else {
      return `${year}-${year+1}`;
    }
  }
  // src/data-source/services/espn-data.service.ts

// src/data-source/services/espn-data.service.ts

async fetchStandingsForYear(year: string): Promise<TeamStats[]> {
    const standingsUrl = `https://www.espn.com/nba/standings/_/season/${year}`;
  
    try {
      const { data } = await firstValueFrom(this.httpService.get(standingsUrl));
      const $ = cheerio.load(data);
  
      const teams: TeamStats[] = [];
  
      // Parse standings table
      $('table.Table tbody tr').each((i, element) => {
        const teamNameElement = $(element).find('td a.AnchorLink');
        if (teamNameElement.length > 0) {
          const teamName = teamNameElement.text().trim();
          const columns = $(element).find('td div.Table__TD');
  
          // Extract wins, losses, and conference
          const record = $(columns[0]).text().trim().split('-');
          const wins = parseInt(record[0], 10);
          const losses = parseInt(record[1], 10);
  
          // Determine conference (Eastern or Western)
          const conference = $(element).closest('table').prev('h2').text().includes('Eastern') ? 'Eastern' : 'Western';
  
          // Create a TeamStats object with required fields
          const teamStats: TeamStats = {
            date: new Date(), // Use the current date
            teamId: null as any, // This will be populated later
            season: year,
            offensiveRating: 0, // Default value
            defensiveRating: 0, // Default value
            threePointPercentage: 0, // Default value
            fieldGoalPercentage: 0, // Default value
            reboundsPerGame: 0, // Default value
            assistsPerGame: 0, // Default value
            turnoversPerGame: 0, // Default value
            stealsPerGame: 0, // Default value
            blocksPerGame: 0, // Default value
            pointsPerGame: 0, // Default value
            gamesPlayed: wins + losses,
            wins,
            losses,
            additionalStats: {}, // Default value
            dataSource: 'ESPN', // Default value
          };
  
          teams.push(teamStats);
        }
      });
  
      return teams;
    } catch (error) {
      this.logger.error(`Error fetching standings for year ${year}: ${error.message}`);
      throw error;
    }
  }
}