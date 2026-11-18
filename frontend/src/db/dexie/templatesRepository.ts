/**
 * PackPilot — Dexie Templates Repository Implementation
 * Handles template storage and queries.
 */

import type { ITemplatesRepository } from '../interfaces'
import type { PackingTemplate } from '../../types'
import { PackPilotDatabase, getDexieDatabase } from './db'

export class DexieTemplatesRepository implements ITemplatesRepository {
  private db: PackPilotDatabase

  constructor(db?: PackPilotDatabase) {
    this.db = db || getDexieDatabase()
  }

  async getAllTemplates(): Promise<PackingTemplate[]> {
    return this.db.templates.toArray()
  }

  async getTemplateById(id: string): Promise<PackingTemplate | null> {
    const template = await this.db.templates.get(id)
    return template || null
  }

  async saveTemplate(template: PackingTemplate): Promise<void> {
    await this.db.templates.put(template)
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.db.templates.delete(id)
  }
}
