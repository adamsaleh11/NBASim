import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument } from '../schemas/team.schema';
import { TeamDTO } from '../dtos/team.dto';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
  ) {}

  async findAll(filters: { conference?: string; division?: string } = {}): Promise<TeamDTO[]> {
    this.logger.log(`Finding all teams with filters: ${JSON.stringify(filters)}`);
    const query: any = {};
    if (filters.conference) query.conference = filters.conference;
    if (filters.division) query.division = filters.division;

    const teams = await this.teamModel.find(query).lean().exec();
    this.logger.log(`Found ${teams.length} teams.`);
    return teams.map(this.mapToTeamDTO);
  }

  async findOne(id: string): Promise<TeamDTO | null> {
    this.logger.log(`Finding team by ID: ${id}`);
    const team = await this.teamModel.findById(id).lean().exec();
    if (!team) {
      this.logger.warn(`Team with ID ${id} not found.`);
      return null; // Or throw NotFoundException if appropriate for your use case
    }
    return this.mapToTeamDTO(team);
  }

  async findByName(name: string): Promise<TeamDTO | null> {
    this.logger.log(`Finding team by name: ${name}`);
    const team = await this.teamModel.findOne({ name }).lean().exec();
    if (!team) {
      this.logger.warn(`Team with name "${name}" not found.`);
      return null; // Or throw NotFoundException
    }
    return this.mapToTeamDTO(team);
  }

  async findByConference(conference: string): Promise<TeamDTO[]> {
    this.logger.log(`Finding teams by conference: ${conference}`);
    const teams = await this.teamModel.find({ conference }).lean().exec();
    this.logger.log(`Found ${teams.length} teams in conference "${conference}".`);
    return teams.map(this.mapToTeamDTO);
  }

  async create(teamData: Partial<Team>): Promise<TeamDTO> {
    this.logger.log(`Creating team: ${JSON.stringify(teamData)}`);
    const team = new this.teamModel(teamData);
    const savedTeam = await team.save();
    this.logger.log(`Team created successfully with ID: ${savedTeam._id}`);
    return this.mapToTeamDTO(savedTeam.toObject());
  }

  async update(id: string, updatedTeam: Partial<Team>): Promise<TeamDTO> {
    this.logger.log(`Updating team with ID: ${id}, data: ${JSON.stringify(updatedTeam)}`);
    const team = await this.teamModel.findByIdAndUpdate(id, updatedTeam, { new: true }).lean().exec();
    if (!team) {
      this.logger.warn(`Team with ID ${id} not found for update.`);
      throw new NotFoundException(`Team with ID ${id} not found for update`); // More specific message
    }
    this.logger.log(`Team with ID ${id} updated successfully.`);
    return this.mapToTeamDTO(team);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing team with ID: ${id}`);
    const result = await this.teamModel.findByIdAndDelete(id).exec();
    if (!result) {
      this.logger.warn(`Team with ID ${id} not found for deletion.`);
      throw new NotFoundException(`Team with ID ${id} not found for deletion`); // More specific message
    }
    this.logger.log(`Team with ID ${id} removed successfully.`);
  }

  private mapToTeamDTO(team: any): TeamDTO {
    return {
      id: team._id.toString(),
      name: team.name,
      conference: team.conference,
      division: team.division,
      abbreviation: team.abbreviation,
      teamLogoUrl: team.teamLogoUrl,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
    };
  }
}