import { Injectable } from '@nestjs/common';
import { Team } from '../teams.model';

@Injectable()
export class TeamsService {
    private teams: Team[] = [];

    findAll(): Team[] {
        return this.teams;
    }

    findOne(id: string): Team | undefined {
        return this.teams.find(team => team.id === id);
    }

    create(team: Team): void {
        this.teams.push(team);
    }

    update(id: string, updatedTeam: Team): void {
        const teamIndex = this.teams.findIndex(team => team.id === id);
        if (teamIndex > -1) {
            this.teams[teamIndex] = updatedTeam;
        }
    }

    remove(id: string): void {
        this.teams = this.teams.filter(team => team.id !== id);
    }
}