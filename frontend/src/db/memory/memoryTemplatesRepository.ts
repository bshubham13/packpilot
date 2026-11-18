/**
 * PackPilot — In-Memory Templates Repository Implementation
 * Fallback for template management when IndexedDB is unavailable.
 */

import type { ITemplatesRepository } from '../interfaces'
import type { PackingTemplate } from '../../types'
import { MemoryStorageState, getSharedMemoryState } from './memoryStorage'

export class MemoryTemplatesRepository implements ITemplatesRepository {
  private state: MemoryStorageState

  constructor(state?: MemoryStorageState) {
    this.state = state || getSharedMemoryState()
  }

  async getAllTemplates(): Promise<PackingTemplate[]> {
    return Array.from(this.state.templates.values())
  }

  async getTemplateById(id: string): Promise<PackingTemplate | null> {
    return this.state.templates.get(id) || null
  }

  async saveTemplate(template: PackingTemplate): Promise<void> {
    this.state.templates.set(template.id, { ...template })
  }

  async deleteTemplate(id: string): Promise<void> {
    this.state.templates.delete(id)
  }
}
