using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialNormalizedSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NormalizedUsername = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    IsAdmin = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BiddingSystems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ModifiedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BiddingSystems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BiddingSystems_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BiddingRoots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BiddingSystemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BiddingRoots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BiddingRoots_BiddingSystems_BiddingSystemId",
                        column: x => x.BiddingSystemId,
                        principalTable: "BiddingSystems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BidNodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RootId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Color = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: true),
                    IsFromSystem = table.Column<bool>(type: "boolean", nullable: false),
                    Explanation = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Condition = table.Column<string>(type: "text", nullable: true),
                    Convention = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    PointsLower = table.Column<int>(type: "integer", nullable: true),
                    PointsUpper = table.Column<int>(type: "integer", nullable: true),
                    SpadesLower = table.Column<int>(type: "integer", nullable: true),
                    SpadesUpper = table.Column<int>(type: "integer", nullable: true),
                    HeartsLower = table.Column<int>(type: "integer", nullable: true),
                    HeartsUpper = table.Column<int>(type: "integer", nullable: true),
                    DiamondsLower = table.Column<int>(type: "integer", nullable: true),
                    DiamondsUpper = table.Column<int>(type: "integer", nullable: true),
                    ClubsLower = table.Column<int>(type: "integer", nullable: true),
                    ClubsUpper = table.Column<int>(type: "integer", nullable: true),
                    SpadesStops = table.Column<decimal>(type: "numeric", nullable: true),
                    HeartsStops = table.Column<decimal>(type: "numeric", nullable: true),
                    DiamondsStops = table.Column<decimal>(type: "numeric", nullable: true),
                    ClubsStops = table.Column<decimal>(type: "numeric", nullable: true),
                    ColorDistribution = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Aces = table.Column<int>(type: "integer", nullable: true),
                    Kings = table.Column<int>(type: "integer", nullable: true),
                    OpenerBid = table.Column<bool>(type: "boolean", nullable: false),
                    SignOff = table.Column<bool>(type: "boolean", nullable: false),
                    OneRoundForcing = table.Column<bool>(type: "boolean", nullable: false),
                    GameForcing = table.Column<bool>(type: "boolean", nullable: false),
                    AutomaticResponse = table.Column<bool>(type: "boolean", nullable: false),
                    GoToOpenings = table.Column<bool>(type: "boolean", nullable: false),
                    IsPreferred = table.Column<bool>(type: "boolean", nullable: false),
                    RealizedGoal = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AiSource = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    InterjectionType = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    InterjectionColor = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    InterjectionValue = table.Column<int>(type: "integer", nullable: true),
                    InterjectionIsFromSystem = table.Column<bool>(type: "boolean", nullable: true),
                    InterjectionExplanation = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BidNodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BidNodes_BidNodes_ParentId",
                        column: x => x.ParentId,
                        principalTable: "BidNodes",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_BidNodes_BiddingRoots_RootId",
                        column: x => x.RootId,
                        principalTable: "BiddingRoots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BiddingRoots_BiddingSystemId",
                table: "BiddingRoots",
                column: "BiddingSystemId");

            migrationBuilder.CreateIndex(
                name: "IX_BiddingSystems_OwnerId_Name",
                table: "BiddingSystems",
                columns: new[] { "OwnerId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BidNodes_ParentId",
                table: "BidNodes",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_BidNodes_RootId",
                table: "BidNodes",
                column: "RootId");

            migrationBuilder.CreateIndex(
                name: "IX_BidNodes_RootId_NodeId",
                table: "BidNodes",
                columns: new[] { "RootId", "NodeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_NormalizedUsername",
                table: "Users",
                column: "NormalizedUsername",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BidNodes");

            migrationBuilder.DropTable(
                name: "BiddingRoots");

            migrationBuilder.DropTable(
                name: "BiddingSystems");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
