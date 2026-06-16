import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import passport from 'passport';
import dotenv from 'dotenv';

dotenv.config();

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'supersecret'
};

passport.use(new JwtStrategy(options, (jwt_payload, done) => {
    // Logic to find user in DB using jwt_payload.id
    // For demonstration, simulating user found
    if (jwt_payload) {
        return done(null, { id: jwt_payload.id, role: jwt_payload.role });
    }
    return done(null, false);
}));
