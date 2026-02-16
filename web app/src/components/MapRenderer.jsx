import React from 'react';
import MapEngine from './MapEngine';
import { monteroConfig } from '../data/mapDefinitions/montero';

/**
 * MapRenderer — USCSS Montero deck plans.
 * Thin wrapper that feeds the Montero map definition into the
 * reusable MapEngine component.
 *
 * To create a new map, add a definition file under
 * src/data/mapDefinitions/ following the montero.jsx pattern,
 * then render it with <MapEngine config={yourConfig} />.
 */
export default function MapRenderer() {
  return <MapEngine config={monteroConfig} />;
}
