import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Rect, Circle, Text as SvgText, G } from 'react-native-svg';
import { theme } from '../theme';
import { BuildingData, getRoomAt } from '../building';
import { heartbeatEngine, HeartbeatState } from '../heartbeat';

interface Props {
  building: BuildingData;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAP_SIZE = Math.min(SCREEN_WIDTH - 32, 340);

export function MoveScreen({ building }: Props) {
  const [heartbeatState, setHeartbeatState] = useState<HeartbeatState>(heartbeatEngine.getState());
  const [descending, setDescending] = useState(false);
  const descendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gridSize = building.grid_size_m || 20;
  const floorsCount = building.floors || 6;
  const currentFloor = heartbeatState.virtualFloor;
  const currentX = heartbeatState.virtualX;
  const currentY = heartbeatState.virtualY;

  useEffect(() => {
    const unsub = heartbeatEngine.subscribe(state => {
      setHeartbeatState(state);
    });
    return unsub;
  }, []);

  useEffect(() => {
    return () => {
      if (descendTimerRef.current) clearInterval(descendTimerRef.current);
    };
  }, []);

  const handleSelectFloor = (floor: number) => {
    if (descending) return;
    heartbeatEngine.setVirtualPosition(floor, currentX, currentY);
  };

  const nudge = (dx: number, dy: number) => {
    if (descending) return;
    const newX = Math.max(0, Math.min(gridSize, currentX + dx));
    const newY = Math.max(0, Math.min(gridSize, currentY + dy));
    heartbeatEngine.setVirtualPosition(currentFloor, newX, newY);
  };

  // Map tap to set (x, y)
  // Note: in coordinates, (0, 0) is bottom-left, so SVG Y needs inverting
  const handleMapPress = (e: GestureResponderEvent) => {
    if (descending) return;
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.max(0, Math.min(gridSize, (locationX / MAP_SIZE) * gridSize));
    const y = Math.max(0, Math.min(gridSize, ((MAP_SIZE - locationY) / MAP_SIZE) * gridSize));
    heartbeatEngine.setVirtualPosition(currentFloor, x, y);
  };

  // "Walk to Stair A and descend" evacuation simulation
  const handleWalkAndDescend = () => {
    if (descending) {
      if (descendTimerRef.current) clearInterval(descendTimerRef.current);
      setDescending(false);
      return;
    }

    setDescending(true);

    // Step 1: Move to Stair A (approx x=2, y=14)
    heartbeatEngine.setVirtualPosition(currentFloor, 2, 14);

    let floor = currentFloor;
    if (floor <= 1) {
      // Already on ground floor
      setDescending(false);
      return;
    }

    // Step down 1 floor every 3 seconds (approx 1.5 heartbeat cycles)
    descendTimerRef.current = setInterval(() => {
      floor -= 1;
      if (floor >= 1) {
        heartbeatEngine.setVirtualPosition(floor, 2, 14);
      }
      if (floor <= 1) {
        if (descendTimerRef.current) clearInterval(descendTimerRef.current);
        setDescending(false);
      }
    }, 3000);
  };

  // Current floor plan layout
  const plan = building.floor_plans?.find(p => p.floor === currentFloor);
  const apsOnFloor = building.aps?.filter(ap => ap.floor === currentFloor) || [];

  const scaleSvg = (val: number) => (val / gridSize) * MAP_SIZE;
  const currentRoomLabel = getRoomAt(currentX, currentY, currentFloor, building);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Demo Location Control</Text>
      <Text style={styles.subtitle}>
        Since your real phone cannot match the simulated building RF environment, adjust your virtual position to test real-time localization.
      </Text>

      {/* Floor Picker Buttons */}
      <Text style={styles.sectionHeading}>Select Floor (1–{floorsCount})</Text>
      <View style={styles.floorPickerRow}>
        {Array.from({ length: floorsCount }, (_, i) => i + 1).map(f => {
          const isSelected = f === currentFloor;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.floorBtn, isSelected && styles.floorBtnActive]}
              onPress={() => handleSelectFloor(f)}
              disabled={descending}
            >
              <Text style={[styles.floorBtnText, isSelected && styles.floorBtnTextActive]}>
                F{f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Current Position Banner */}
      <View style={styles.positionBanner}>
        <View>
          <Text style={styles.posBannerLabel}>CURRENT VIRTUAL LOCATION</Text>
          <Text style={styles.posBannerValue}>
            Floor {currentFloor} • {currentRoomLabel}
          </Text>
        </View>
        <Text style={styles.posCoords}>
          ({currentX.toFixed(1)}m, {currentY.toFixed(1)}m)
        </Text>
      </View>

      {/* Mini Floor Plan SVG */}
      <Text style={styles.sectionHeading}>Tap Map to Relocate</Text>
      <View style={styles.mapContainer}>
        <TouchableOpacity activeOpacity={1} onPress={handleMapPress} disabled={descending}>
          <Svg width={MAP_SIZE} height={MAP_SIZE} style={styles.svgMap}>
            {/* Background Grid */}
            <Rect
              x={0}
              y={0}
              width={MAP_SIZE}
              height={MAP_SIZE}
              fill="#101923"
              stroke={theme.colors.line}
              strokeWidth={2}
            />

            {/* Corridor */}
            {plan?.corridor && (
              <Rect
                x={scaleSvg(plan.corridor.x)}
                y={scaleSvg(gridSize - plan.corridor.y - plan.corridor.height)}
                width={scaleSvg(plan.corridor.width)}
                height={scaleSvg(plan.corridor.height)}
                fill="#17222d"
                stroke="#2a3b4d"
                strokeWidth={1}
              />
            )}

            {/* Rooms */}
            {plan?.rooms?.map(room => {
              const rx = scaleSvg(room.x);
              const ry = scaleSvg(gridSize - room.y - room.height);
              const rw = scaleSvg(room.width);
              const rh = scaleSvg(room.height);
              const isStair = room.kind === 'stairs';
              return (
                <G key={room.id}>
                  <Rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={isStair ? '#233240' : '#151d26'}
                    stroke="#33404d"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={rx + rw / 2}
                    y={ry + rh / 2 + 3}
                    fill="#a9b8c7"
                    fontSize={rw < 50 ? 8 : 10}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {room.label}
                  </SvgText>
                </G>
              );
            })}

            {/* AP Markers */}
            {apsOnFloor.map(ap => {
              const apx = scaleSvg(ap.x);
              const apy = scaleSvg(gridSize - ap.y);
              return (
                <G key={ap.id}>
                  <Circle cx={apx} cy={apy} r={6} fill="#ffd078" stroke="#10151b" strokeWidth={1} />
                  <SvgText x={apx} y={apy - 8} fill="#ffd078" fontSize={9} fontWeight="700" textAnchor="middle">
                    {ap.id}
                  </SvgText>
                </G>
              );
            })}

            {/* Occupant Phone Marker */}
            <Circle
              cx={scaleSvg(currentX)}
              cy={scaleSvg(gridSize - currentY)}
              r={9}
              fill={theme.colors.accent}
              stroke="#ffffff"
              strokeWidth={2}
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* D-Pad Controls */}
      <Text style={styles.sectionHeading}>Nudge Position (±1 meter)</Text>
      <View style={styles.dpadContainer}>
        <TouchableOpacity style={styles.dpadBtn} onPress={() => nudge(0, 1)} disabled={descending}>
          <Text style={styles.dpadText}>▲ North (+1m)</Text>
        </TouchableOpacity>
        <View style={styles.dpadMiddleRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => nudge(-1, 0)} disabled={descending}>
            <Text style={styles.dpadText}>◄ West (-1m)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => nudge(1, 0)} disabled={descending}>
            <Text style={styles.dpadText}>East (+1m) ►</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.dpadBtn} onPress={() => nudge(0, -1)} disabled={descending}>
          <Text style={styles.dpadText}>▼ South (-1m)</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action: Evacuation Demo */}
      <View style={styles.evacSection}>
        <TouchableOpacity
          style={[styles.evacBtn, descending && styles.evacBtnActive]}
          onPress={handleWalkAndDescend}
        >
          <Text style={styles.evacBtnText}>
            {descending ? '⏹ Stop Evacuation Demo' : '🏃 Walk to Stair A and descend'}
          </Text>
        </TouchableOpacity>
        {descending && (
          <Text style={styles.descendingNote}>
            Evacuating via Stair A: descending to Floor 1 every 3 seconds...
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 10,
    paddingBottom: theme.spacing.xxl * 2,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  sectionHeading: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  floorPickerRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  floorBtn: {
    flex: 1,
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  floorBtnActive: {
    backgroundColor: theme.colors.panelHighlight,
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  floorBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  floorBtnTextActive: {
    color: theme.colors.text,
  },
  positionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  posBannerLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  posBannerValue: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2,
  },
  posCoords: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  mapContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  svgMap: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  dpadContainer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.md,
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  dpadBtn: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minWidth: 120,
    alignItems: 'center',
  },
  dpadText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  evacSection: {
    marginTop: theme.spacing.lg,
  },
  evacBtn: {
    backgroundColor: theme.colors.panelElevated,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  evacBtnActive: {
    backgroundColor: '#382226',
    borderColor: theme.colors.red,
  },
  evacBtnText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '800',
  },
  descendingNote: {
    color: theme.colors.amber,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    fontWeight: '600',
  },
});
