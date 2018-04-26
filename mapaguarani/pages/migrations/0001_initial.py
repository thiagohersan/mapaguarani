# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2018-04-25 16:30
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('flatpages', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Page',
            fields=[
                ('flatpage_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='flatpages.FlatPage')),
                ('order', models.IntegerField(blank=True, default=0, null=True, verbose_name='Order')),
            ],
            bases=('flatpages.flatpage',),
        ),
    ]
