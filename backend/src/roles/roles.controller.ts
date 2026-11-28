import { Controller, Get, Param, Put, Body, Post, Delete } from '@nestjs/common';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(+id);
  }

  @Put(':id/permissions')
  updatePermissions(@Param('id') id: string, @Body('permissions') permissions: string[]) {
    return this.rolesService.updatePermissions(+id, permissions);
  }

  @Post()
  create(@Body('name') name: string) {
    return this.rolesService.create(name);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(+id);
  }
}
