// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CertifyPro {

    address public owner;

    struct Certificate {
        string  studentName;
        string  degree;
        string  university;
        uint256 issuedAt;
        address issuedBy;
        bool    exists;
    }

    mapping(bytes32 => Certificate) private certificates;
    mapping(address => bool) public authorizedIssuers;

    event CertificateIssued(
        bytes32 indexed certHash,
        string  studentName,
        string  university,
        uint256 issuedAt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can do this");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(
            authorizedIssuers[msg.sender],
            "You are not an authorized university"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    function authorizeIssuer(address _issuer) external onlyOwner {
        authorizedIssuers[_issuer] = true;
    }

    function revokeIssuer(address _issuer) external onlyOwner {
        authorizedIssuers[_issuer] = false;
    }

    function issueCertificate(
        bytes32 _certHash,
        string  memory _studentName,
        string  memory _degree,
        string  memory _university
    ) external onlyAuthorizedIssuer {

        require(
            !certificates[_certHash].exists,
            "Certificate already issued"
        );

        certificates[_certHash] = Certificate({
            studentName: _studentName,
            degree:      _degree,
            university:  _university,
            issuedAt:    block.timestamp,
            issuedBy:    msg.sender,
            exists:      true
        });

        emit CertificateIssued(
            _certHash,
            _studentName,
            _university,
            block.timestamp
        );
    }

    function verifyCertificate(bytes32 _certHash)
        external
        view
        returns (
            bool    isValid,
            string  memory studentName,
            string  memory degree,
            string  memory university,
            uint256 issuedAt,
            address issuedBy
        )
    {
        Certificate memory cert = certificates[_certHash];

        if (!cert.exists) {
            return (false, "", "", "", 0, address(0));
        }

        return (
            true,
            cert.studentName,
            cert.degree,
            cert.university,
            cert.issuedAt,
            cert.issuedBy
        );
    }
}
