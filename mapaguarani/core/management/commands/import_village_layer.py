from django.core.management.base import BaseCommand
from django.contrib.gis.gdal import DataSource
from core.models import IndigenousVillage, MapLayer, EthnicGroup, GuaraniPresence, Population, ProminentEthnicSubGroup, Project, ActionField

import datetime


class Command(BaseCommand):
    help = 'Import village layer'

    def add_arguments(self, parser):
        parser.add_argument('shapefile_path', nargs='+', type=str)

    def handle(self, *args, **options):

        shapefile_path = options['shapefile_path'][0]
        ds = DataSource(shapefile_path)
        source_layer = ds[0]

        def _get_ethnic_group(groups):

            groups_names = groups.split(',')

            for group_name in groups_names:
                group_name = group_name.strip()
                if group_name:
                    group, created = EthnicGroup.objects.get_or_create(name=group_name)
                    if created:
                        print('Criado grupo etnico: ' + group_name)
                    yield group

        def _get_ethnic_subgroup(groups):
            groups_names = groups.split(',')

            for group_name in groups_names:
                group_name = group_name.strip()
                if group_name:
                    group, created = ProminentEthnicSubGroup.objects.get_or_create(name=group_name)
                    if created:
                        print('Criado subgrupo etnico: ' + group_name)
                    yield group

        for feat in source_layer:

            villages_layer, _ = MapLayer.objects.get_or_create(name=feat.get('layer'))
            villages_layer.save()
            kwargs = {
                'layer': villages_layer,
            }
            try:
                kwargs['name'] = feat.get('name')
            except:
                kwargs['name'] = ''
                # print('Nome da aldeia ausente')

            try:
                kwargs['other_names'] = feat.get('other_name')
            except:
                kwargs['other_names'] = ''
                # print('Outras denominações da aldeia ausente')

            try:
                kwargs['position_source'] = feat.get('position_source')
            except:
                kwargs['position_source'] = ''
                # print('Fonte da localização da aldeia ausente')

            try:
                kwargs['private_comments'] = feat.get('private_co')
            except:
                kwargs['private_comments'] = ''
                # print('Observações restritas da aldeia ausente')

            try:
                kwargs['public_comments'] = feat.get('public_com')
            except:
                kwargs['public_comments'] = ''
                # print('Observações da aldeia ausente')

            indigenous_village = IndigenousVillage(**kwargs)

            try:
                position_precision = feat.get('position_p')
            except:
                position_precision = None
                # print('Nome da aldeia ausente')

            if position_precision == 'Exata' or position_precision == 'Exato' or position_precision == 'Exact':
                indigenous_village.position_precision = 'exact'
            elif position_precision == 'Aproximada':
                indigenous_village.position_precision = 'approximate'
            elif not position_precision:
                indigenous_village.position_precision = 'no_info'
            else:
                self.stdout.write('Precisão da posição não encontrata: ' + position_precision)

            indigenous_village.status = 'public'

            indigenous_village.geometry = feat.geom.wkt

            try:
                # try to save as MultPolygon
                indigenous_village.save()
            except:
                self.stdout.write('Falha ao salvar aldeia indígena\n')

            try:
                ethnic_groups_raw = feat.get('ethnic_gro')
                ethnic_groups = _get_ethnic_group(ethnic_groups_raw)
                for group in ethnic_groups:
                    indigenous_village.ethnic_groups.add(group)
            except:
                pass

            try:
                ethnic_subgroups_raw = feat.get('prominent_')
                ethnic_subgroups = _get_ethnic_subgroup(ethnic_subgroups_raw)
                for ethnic_subgroup in ethnic_subgroups:
                    indigenous_village.prominent_subgroup.add(ethnic_subgroup)
            except:
                pass

            try:
                guarani_presence = feat.get('guarani_pr')
            except:
                guarani_presence = ''
            if guarani_presence == 'Sim' or guarani_presence == 'Habitada atualmente':
                # FIXME ver questão da fonte.
                guarani_presence = GuaraniPresence(
                    presence=True, date=datetime.date(2016, 1, 1), source='Mapa Guarani Continental 2016', village=indigenous_village)
                guarani_presence.save()
            elif guarani_presence == 'Não':
                pass
            else:
                self.stdout.write('Falha ao ler Presença Guarani. Valor: ' + guarani_presence)

            try:
                population = feat.get('population')
            except:
                population = None
            if population:
                try:
                    population = int(population.split()[0])
                    population = Population(
                        population=population,
                        date=datetime.date(2016, 1, 1),
                        source='Mapa Guarani Continental 2016',
                        village=indigenous_village
                    )
                    population.save()
                except:
                    self.stdout.write('Falha ao ler população. População: ' + str(population))

            indigenous_village.save()

            try:
                project_name = feat.get('PROJETO')
                if project_name:
                    project, created = Project.objects.get_or_create(name=project_name)
                    project.indigenous_villages.add(indigenous_village)
                    project.save()
                    if created:
                        self.stdout.write('Projeto ' + project_name + ' criado com sucesso!!!')
            except:
                pass

            try:
                action_field_name = feat.get('AREA_ATU')
                if action_field_name:
                    action_field, created = ActionField.objects.get_or_create(name=action_field_name)
                    action_field.layers.add(villages_layer)
                    action_field.save()
                    if created:
                        self.stdout.write('Área de atuação ' + action_field_name + ' criada com sucesso!!!')
            except:
                pass

        self.stdout.write('\n')
        self.stdout.write(
            'Camada de aldeias importada com sucesso! Caminho do arquivo fornecido: "%s"' % shapefile_path)
        self.stdout.write('\n')
