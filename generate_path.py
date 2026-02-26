import random
import math

def interpolate(p1, p2, num_points, noise=0.00005):
    points = []
    for i in range(num_points):
        f = i / num_points
        lat = p1[0] + (p2[0] - p1[0]) * f + (random.random() - 0.5) * noise
        lng = p1[1] + (p2[1] - p1[1]) * f + (random.random() - 0.5) * noise
        points.append([round(lat, 5), round(lng, 5)])
    return points

# Waypoints for Dragon's Back (approximate based on maps)
waypoints = [
    [22.22432, 114.23431], # Start: To Tei Wan
    [22.22650, 114.23680], # Ascent
    [22.23120, 114.24150], # Shek O Peak
    [22.23450, 114.24350], # Ridge line 1
    [22.23850, 114.24280], # Ridge line 2
    [22.24200, 114.24200], # Mount Collinson junction
    [22.24550, 114.24150], # Junction with Shek O Rd (approx)
    [22.24850, 114.24550], # Towards Big Wave Bay
    [22.24650, 114.24950], # Entering forest
    [22.24500, 114.25150], # Zig-zag start
    [22.24420, 114.25300], # Zig 1
    [22.24580, 114.25350], # Zag 1
    [22.24450, 114.25450], # Zig 2
    [22.24590, 114.25550], # Zag 2
    [22.24480, 114.25700], # Final descent
    [22.24510, 114.25820]  # End: Big Wave Bay
]

full_path = []
for i in range(len(waypoints) - 1):
    num_pts = 10 if i < 10 else 15 # Denser for zig-zags
    if i >= 9: # Zig-zags section
        num_pts = 12
    segment = interpolate(waypoints[i], waypoints[i+1], num_pts)
    full_path.extend(segment)

# Add last point
full_path.append(waypoints[-1])

print("export const DRAGONS_BACK_COORDINATES: [number, number][] = [")
for p in full_path:
    print(f"  [{p[0]:.5f}, {p[1]:.5f}],")
print("];")
