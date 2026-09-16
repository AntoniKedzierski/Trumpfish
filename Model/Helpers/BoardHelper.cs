using Model.Enums;

namespace Model.Helpers;

public static class BoardHelper {

    /*
     * The four board rotation: nobody, North and South, East and West, both, repeating from the fifth board on. Assigned by
     * the board rather than played for - at a tournament every table plays board seven with the same pair vulnerable, which
     * is what makes two tables' results comparable.
     */
    private static readonly Vulnerability[] Rotation = [Vulnerability.None, Vulnerability.NorthSouth, Vulnerability.EastWest, Vulnerability.Both];

    /// <summary>Who is vulnerable on the board with this index, counted from zero the way a deal is numbered within a session.</summary>
    public static Vulnerability VulnerabilityOf(int boardIndex) {
        return Rotation[((boardIndex % Rotation.Length) + Rotation.Length) % Rotation.Length];
    }
}
